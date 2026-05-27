# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template

## デプロイ手順

### 設定ファイルを作成

`lib/param-type.ts` に沿って `params.環境名.json` ファイルを作成する。

`環境名` には `dev` と `prod` が利用できる。

`環境名` は増やすこともできる。例えば `環境名` に `stg` を追加する場合は、`params.stg.json` ファイルを作成する。実行コマンドは、`ENV_NAME=stg npm run cdk deploy Mastodon***Stack-stg` となる。

初期デプロイの場合は、以下の項目は `null` を設定する。

```
app.secretKeyBase
app.otpSecret
app.activeRecord.encryption.deterministicKey
app.activeRecord.encryption.keyDerivationSalt
app.activeRecord.encryption.primaryKey
```

### 初期デプロイ

`環境名` が `dev` の場合の構築例を示す。

1. Route53 をデプロイする。
   ```
   npm run deploy:dev MastodonRoute53Stack-dev
   ```
1. Route53 にホストゾーンが作られるので、NS レコードを DNS プロバイダに設定する。
1. グローバル証明書をデプロイする
   ```
   npm run deploy:dev MastodonGlobalCertStack-dev
   ```
1. リージョナル証明書をデプロイする
   ```
   npm run deploy:dev MastodonRegionalCertStack-dev
   ```
1. インフラ (VPC, S3, コンテンツ配信 CDN) をデプロイする。
   ```
   npm run deploy:dev MastodonInfraStack-dev
   ```
1. RDS をデプロイする。
   ```
   npm run deploy:dev MastodonRdsStack-dev
   ```
1. ElastiCache をデプロイする。
   ```
   npm run deploy:dev MastodonElasticacheStack-dev
   ```
1. ElasticSearch/OpenSearch を建てる場合 ElasticSearch をデプロイする。
   ```
   npm run deploy:dev MastodonElasticSearchStack-dev
   ```
1. 踏み台をデプロイする。
   ```
   npm run deploy:dev MastodonBastionStack-dev
   ```
1. 踏み台で作業する。マネージメントコンソールから SSM で接続する。
1. スーパーユーザーにスイッチする。
   ```
   sudo -i
   ```
1. `tail -f /var/log/cloud-init-output.log` で初期実行スクリプトの実行完了を待つ。30 分ほどかかる。
1. mastodon ユーザーにスイッチする。
   ```
   su - mastodon
   ```
1. データベースを初期化する。
   ```
   cd mastodon
   RAILS_ENV=production bundle exec rails db:setup
   ```
1. オーナーユーザーを作成する。
   ```
   RAILS_ENV=production bin/tootctl accounts create アカウント名 --email メールアドレス --confirmed --role Owner
   RAILS_ENV=production bin/tootctl accounts modify アカウント名 --approve
   ```
1. スタックの更新に備えて以下の値を `.env.production` ファイルから `params.dev.json` ファイルに転記する。
   - `SECRET_KEY_BASE` → `app.secretKeyBase`
   - `OTP_SECRET` → `app.otpSecret`
   - `ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY` → `app.activeRecord.encryption.deterministicKey`
   - `ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT` → `app.activeRecord.encryption.keyDerivationSalt`
   - `ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY` → `app.activeRecord.encryption.primaryKey`
1. アプリケーションをデプロイする
   ```
   npm run deploy:dev MastodonAppStack-dev
   ```
1. アプリケーションサーバーで作業する。マネージメントコンソールから、SSM で接続する。
1. `tail -f /var/log/cloud-init-output.log` で初期実行スクリプトの実行完了を待つ。30 分ほどかかる。
1. 設定したドメインのホストにブラウザで接続して動作確認をする。`journalctl -f` で Mastodon サーバーのログを監視できる。
1. 課金を抑えるため、マネージメントコンソールで、踏み台のインスタンスを停止する。

本番環境の場合は、各デプロイコマンドは `npm run deploy:prod Mastodon******Stack-prod` となる。

### アップデート

1. params.\*.json の `mastodon.git.tag` を目的のリリースタグに変更する。
1. `npm run deploy:dev MastodonAppStack-dev` を実行してスタックを更新する。(本番環境の場合は `npm run deploy:prod MastodonAppStack-prod`)
1. マネージメントコンソール → EC2 → Auto Scaling グループで `MastodonAppStack` で始まる Auto Scaling グループを選択し、「希望するキャパシティ」「最小の希望する容量」「最大の希望する容量」をすべて 2 に設定する。
1. マネージメントコンソール → EC2 → ターゲットグループで `Mastod-appli` で始まるターゲットグループを選択し、「登録済みターゲット」を監視する。
1. 「起動時間」が直近のインスタンスが、「Healthy」になるまで待つ。30分ほどかかる。
1. 古い方のインスタンスを登録解除し、インスタンスを終了(破棄)する。
1. ターゲットグループの「Healthy」インスタンスが再び 2 つになったら、Autho Scaling グループのキャパシティをすべて 1 に変更する。

### マイグレーション

1. マネージメントコンソールで、踏み台のインスタンスを起動する。
1. SSM などで踏み台にログインする。
1. Mastodon のリリースノートの指示に従い作業する。
   ```
   sudo -iu mastodon
   cd mastodon
   git fetch
   git checkout <<VERSION>>
   # ここ以下は Mastodon のリリースノートの指示に従う
   bundle install
   yarn install
   RAILS_ENV=production bundle exec rails db:migrate
   ```
1. [アップデート](#アップデート) 手順に従って Mastodon のアプリケーションサーバーを更新する。
