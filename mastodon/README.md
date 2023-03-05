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

### オレオレ証明書を作る

最終的には Let's Encrypt などの正式な証明書を使うが、そのつなぎとしてオレオレ証明書を生成する。

1. 証明書を作成する
   ```
   openssl genrsa 2048 > server.key
   openssl req -new -key server.key > server.csr
   # Commmon Name にサーバーの FQDN を設定する
   openssl x509 -days 3650 -req -sha256 -signkey server.key < server.csr > server.crt

   ls
   server.crt  server.csr  server.key
   ```
1. AWS ACM に追加する
   ```
   aws acm import-certificate --region <<リージョン>> --certificate fileb://server.crt --private-key fileb://server.key
   ```
1. CertificateArn を .env ファイルの `LB_CERTIFICATE_ARN` に設定する。


### デプロイ

1. 踏み台までデプロイする。
    ```
    cdk deploy MastodonInfraStack MastodonRdsStack MastodonElasticacheStack MastodonBastionStack
    ```
1. 踏み台で作業する。マネージメントコンソールから、`MastodonBastionStack/bastion/mastodon-bastion-instance` のパブリック IP アドレスを取得して、SSH で接続する。
1. mastodon ユーザーにスイッチする。
    ```
    sudo -iu mastodon
    ```
1. データベースを初期化する。
    ```
    cd mastodon
    pnpm run init
    ```
1. アプリケーションをデプロイする
    ```
    cdk deploy MastodonAppStack
    ```
1. DNS の設定をする。マネージメントコンソールから、`Missk-appli-********` のロードバランサーの DNS name を取得し、DNS の CNAME に設定する。
1. アプリケーションサーバーで作業する。マネージメントコンソールから、`MastodonAppStack/app/mastodon-app-asg` のプライベート IP アドレスを取得して、踏み台をプロキシにして SSH で接続する。
1. Let's Encrypt で証明書を取得する。まずは dry-run してみる。
    ```
    sudo -i
    certbot certonly --dry-run

    Saving debug log to /var/log/letsencrypt/letsencrypt.log

    How would you like to authenticate with the ACME CA?
    - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    1: Spin up a temporary webserver (standalone)
    2: Place files in webroot directory (webroot)
    - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    Select the appropriate number [1-2] then [enter] (press 'c' to cancel): 1 <<<<< 1にする
    Plugins selected: Authenticator standalone, Installer None
    Please enter the domain name(s) you would like on your certificate (comma and/or
    space separated) (Enter 'c' to cancel): mastodon.example.com
    Simulating a certificate request for mastodon.example.com
    Performing the following challenges:
    http-01 challenge for mastodon.example.com
    Waiting for verification...
    Cleaning up challenges
    The dry run was successful.
    ```
1. 本番実行する
    ```
    certbot certonly --standalone -d <<ドメイン>>
    ```
1. AWS ACM にインポートする。
    ```
    aws acm import-certificate --region <<リージョン>> \
    --certificate-arn <<ARN>> \
    --certificate fileb:///etc/letsencrypt/live/<<ドメイン>>/cert.pem \
    --private-key fileb:///etc/letsencrypt/live/<<ドメイン>>/privkey.pem \
    --certificate-chain fileb:///etc/letsencrypt/live/<<ドメイン>>/privkey.pem
    ```
    * `New certificate is missing one or more Key Usages supported by the currently imported certificate` というエラーが発生したら、証明書を切り替える。
1. マネージメントコンソールで、踏み台のインスタンスを停止する。


### アップデート

1. `mastodon-infra/lib/app/app-stack.ts` の `minCapacity` を 2 に変更し、`cdk deploy MastodonAppStack` を実行する。
1. マネージメントコンソールで `MastodonAppStack/app/mastodon-app-asg` インスタンスが 2 つになったら、古い方のインスタンスを終了する。
1. `MastodonAppStack/app/mastodon-app-asg` インスタンスが再び 2 つになったら、`mastodon-infra/lib/app/app-stack.ts` の `minCapacity` を 1 に変更し、`cdk deploy MastodonAppStack` を実行する。


### マイグレーション

1. マネージメントコンソールで、踏み台のインスタンスを起動する。
1. 踏み台にログインする。
    ```
    sudo -iu mastodon
    cd mastodon
    git fetch
    git pull
    NODE_ENV=production pnpm install --frozen-lockfile
    pnpm run clean
    NODE_ENV=production pnpm run build
    pnpm run migrate
    ```
1. 「アップデート」手順に従って Mastodon のアプリケーションサーバーを更新する。
