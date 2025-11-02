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
`環境名` は増やすこともできる。`環境名` を追加した場合は、`ENV_NAME=環境名 npm run deploy ...` とする。


### デプロイ

1. Route53 をデプロイする。
    ```
    npm run deploy MastodonRoute53Stack-dev
    ```
1. Route53 にホストゾーンが作られるので、NS レコードを DNS プロバイダに設定する。
1. グローバル証明書をデプロイする
    ```
    npm run deploy MastodonGlobalCertStack-dev
    ```
1. リージョナル証明書をデプロイする
    ```
    npm run deploy MastodonRegionalCertStack-dev
    ```
1. インフラをデプロイする。
    ```
    npm run deploy MastodonInfraStack-dev
    ```
1. RDS をデプロイする。
    ```
    npm run deploy MastodonRdsStack-dev
    ```
1. ElastiCache をデプロイする。
    ```
    npm run deploy MastodonElasticacheStack-dev
    ```
1. 踏み台をデプロイする。
    ```
    npm run deploy MastodonBastionStack-dev
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
1. アプリケーションをデプロイする
    ```
    npm run deploy MastodonAppStack-dev
    ```
1. アプリケーションサーバーで作業する。マネージメントコンソールから、SSM で接続する。
1. `tail -f /var/log/cloud-init-output.log` で初期実行スクリプトの実行完了を待つ。30 分ほどかかる。
1. 設定したドメインのホストにブラウザで接続して動作確認をする。
1. マネージメントコンソールで、踏み台のインスタンスを停止する。


### アップデート

1. `mastodon/lib/app/app-stack.ts` の `minCapacity` を 2 に変更し、`cdk deploy MastodonAppStack` を実行する。
1. マネージメントコンソールで `MastodonAppStack/app/mastodon-app-asg` インスタンスが 2 つになったら、新しい方のインスタンスに踏み台をプロキシにして SSH で接続する。
1. `tail -f /var/log/cloud-init-output.log` で初期実行スクリプトの実行完了を待つ。30 分ほどかかる。
1. 古い方のインスタンスを終了する。
1. `MastodonAppStack/app/mastodon-app-asg` インスタンスが再び 2 つになったら、`mastodon/lib/app/app-stack.ts` の `minCapacity` を 1 に変更し、`cdk deploy MastodonAppStack` を実行する。


### マイグレーション

1. マネージメントコンソールで、踏み台のインスタンスを起動する。
1. 踏み台にログインする。
    ```
    sudo -iu mastodon
    cd mastodon
    git fetch
    git checkout <<VERSION>>
    bundle install
    yarn install
    RAILS_ENV=production bundle exec rails db:migrate
    ```
1. 「アップデート」手順に従って Mastodon のアプリケーションサーバーを更新する。
