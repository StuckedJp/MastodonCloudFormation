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

### .env ファイルを作成

1. `.env.sample` をコピーして `.env` ファイルを作成する。
1. `.env` ファイルの内容をサーバーの構成に合わせて編集する。

### ACM に証明書を作る

1. AWS マネージメントコンソールにログインする。
1. 証明書をリクエストする。
1. 「パブリック証明書をリクエスト」を選択して「次へ」を押す。
1. 「完全修飾ドメイン名」に Mastodon の　FQDN と Mastodon の添付ファイルを配信するホストの FQDN を設定する。
1. 検証方法は「DNS 検証」にする
1. キーアルゴリズムは「RSA 2048」にする。
1. 「リクエスト」ボタンを押す。
1. DNS サーバーに、AWS が提示した CNAME を設定する。
1. 証明書が「発行済」になったら、証明書の ARN を .env ファイルの `LB_CERTIFICATE_ARN`、`MASTODON_ATTACHMENT_CERTIFICATE_ARN` に設定する。


### デプロイ

1. 踏み台までデプロイする。
    ```
    cdk deploy MastodonInfraStack MastodonRdsStack MastodonElasticacheStack MastodonBastionStack
    ```
1. 踏み台で作業する。マネージメントコンソールから、`MastodonBastionStack/bastion/mastodon-bastion-instance` のパブリック IP アドレスを取得して、SSH で接続する。
1. `tail -f /var/log/cloud-init-output.log` で初期実行スクリプトの実行完了を待つ。20 分ほどかかる。
1. mastodon ユーザーにスイッチする。
    ```
    sudo -iu mastodon
    ```
1. データベースを初期化する。
    ```
    cd mastodon
    RAILS_ENV=production bundle exec rails db:migrate
    ```
1. アプリケーションをデプロイする
    ```
    cdk deploy MastodonAppStack
    ```
1. DNS の設定をする。マネージメントコンソールから、`Masto-appli-********` のロードバランサーの DNS name を取得し、DNS の CNAME に設定する。
1. アプリケーションサーバーで作業する。マネージメントコンソールから、`MastodonAppStack/app/mastodon-app-asg` のプライベート IP アドレスを取得して、踏み台をプロキシにして SSH で接続する。
1. `tail -f /var/log/cloud-init-output.log` で初期実行スクリプトの実行完了を待つ。30 分ほどかかる。
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
