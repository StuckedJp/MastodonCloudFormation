# CloudFormation Template for Mastodon Cookbook (Auto Scaling & Application Load Balancing)


## 1つのインフラスタックで構築したリソースを使って、複数の Mastodon インスタンスを起動する

* VPC、Subnet、NAT、踏み台サーバは共通で利用します。
* RDS も共通で利用します。ただし、スキーマを分けます。
* ElastiCache(Redis) も共通で利用します。ただし、データベースを分けます。
* S3 の構成は以下のようにします。`Instance1` は構築済み、`Instance2` を追加で構築する Mastodon インスタンスとします。

    ```
    Bucket_for_Instance1
    +--- LoadBalancer_Log
    +--- CloudFormation_templates
    `--- PreBuilded_Package
    Bucket_for_Instance1_Cache

    Bucket_for_Instance2
    +--- LoadBalancer_Log
    +--- CloudFormation_templates
    `--- PreBuilded_Package
    Bucket_for_Instance2_Cache
    ```
    * S3 のコンテンツキャッシュは Mastodon インスタンスごとに作成します。
    * S3 のログ置き場は Mastodon インスタンスごとに作成します。
    * S3 の事前ビルドパッケージ置き場は Mastodon インスタンスごとに作成します。


### バケットポリシーの設定

`Bucket_for_Instance2` に、`LoadBalancer_Log` のためのバケットポリシーを設定します。以下は例です。
詳細については、[AWS ドキュメントの Application Load Balancer のアクセスログ](http://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/load-balancer-access-logs.html#access-logging-bucket-permissions) を参考にします。

```json
{
    "Version": "2012-10-17",
    "Id": "Policy1493789607994",
    "Statement": [
        {
            "Sid": "Stmt1493789603166",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::[ELB アカウントID]:root"
            },
            "Action": "s3:PutObject",
            "Resource": "arn:aws:s3:::[Bucket_for_Instance2]/[LoadBalancer_Log]/AWSLogs/[AWS UserId]/*"
        }
    ]
}
```


### VPC Endpoint の変更

VPC エンドポイントに `Bucket_for_Instance2` を追加します。

1. AWS コンソールにアクセスし、[VPC]→[エンドポイント]を開きます。
1. Mastodon の VPC を選択し [ポリシー]タブを開きます。
1. [ポリシーの編集] ボタンを押して、`Resource` 配列に、`Bucket_for_Instance2` を追加します。以下は例です。

    ```json
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:*",
                "Resource": [
                    "arn:aws:s3:::cloudformation-examples/*",
                    "arn:aws:s3:::[Bucket_for_Instance1]/*",
                    "arn:aws:s3:::[Bucket_for_Instance1_Cache]/*",
                    "arn:aws:s3:::[Bucket_for_Instance2]/*",
                    "arn:aws:s3:::[Bucket_for_Instance2_Cache]/*"
                ]
            }
        ]
    }
    ```


### 踏み台のインスタンスポリシーの変更

踏み台サーバに `Bucket_for_Instance2` へのアクセス権限を付与します。

1. AWS コンソールにアクセスし、[EC2]→[インスタンス]を開きます。
1. 踏み台サーバのインスタンスを選択し、[アクション]→[インスタンスの設定]→[Attach/Replace IAM Role] を実行します。
1. [新しいIAMロールを作成する]リンクを新しいタブで開きます。
1. IAM ロールを選択します。「[インフラスタック名]-BastionInstanceIAMRole-[A-Z0-9]+」のような名前になっているものを選択します。
1. [インラインポリシー]の[ポリシーの編集]に移動します。
1. [ポリシードキュメント]を編集し、`Bucket_for_Instance2` を追加します。以下は例です。

    ```json
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Action": "s3:*",
                "Resource": "arn:aws:s3:::[Bucket_for_Instance1]",
                "Effect": "Allow"
            },
            {
                "Action": "s3:*",
                "Resource": "arn:aws:s3:::[Bucket_for_Instance1]/*",
                "Effect": "Allow"
            },
            {
                "Action": "s3:*",
                "Resource": "arn:aws:s3:::[Bucket_for_Instance1_Cache]",
                "Effect": "Allow"
            },
            {
                "Action": "s3:*",
                "Resource": "arn:aws:s3:::[Bucket_for_Instance1_Cache]/*",
                "Effect": "Allow"
            },
            {
                "Action": "s3:*",
                "Resource": "arn:aws:s3:::[Bucket_for_Instance2]",
                "Effect": "Allow"
            },
            {
                "Action": "s3:*",
                "Resource": "arn:aws:s3:::[Bucket_for_Instance2]/*",
                "Effect": "Allow"
            }
        ]
    }
    ```

1. [ポリシーの適用]を押します。



### 事前ビルドパッケージの作成

踏み台サーバにログインし、`Instance2` 用のパッケージを作成します。

1. 踏み台サーバに SSH でログインします。
1. `sudo su`
1. `cd ~mastodon`
1. `cp -rp [Instance1] [Instance2]`
1. `cd [Instance2]`
1. `.env.production` の以下の項目を変更および追加します。
    * `REDIS_DB`
        * 1以上、15以下の数値を設定します。他の Mastodon インスタンスが使っていない値を指定します。(0 は `Instance1` が使っています。)
    * `DB_NAME`
        * 他の Mastodon インスタンスが使っていない値を指定します。
    * `LOCAL_DOMAIN`
        * `Instance2` が使うドメイン名を指定します。
    * `S3_BUCKET`
        * `Bucket_for_Instance2_Cache` のバケット名を指定します。
1. ビルドしなおして、パッケージを作成します。

    ```
    rm -fr vendor/bundle
    bundle install --deployment --without development test
    yarn install --pure-lockfile
    RAILS_ENV=production bundle exec rails db:setup
    RAILS_ENV=production bundle exec rails assets:precompile
    cd ..
    tar cfz  [PreBuilded_Package_for_Instance2] [Instance2]
    aws s3 cp [PreBuilded_Package_for_Instance2] s3://[Bucket_for_Instance2]/[PreBuilded_Package]/
    ```


### `Instance2` の証明書を ACM に登録する

1. 取得済みの SSL 証明書があれば、それを Certificate Manager にインポートします。ここでは、Let's Encrypt を使いますので、まずオレオレ証明書を作成します。

    ```
    openssl genrsa -des3 -out server.key 2048
    openssl req -new -key server.key -out server.csr
    cp server.key server.key.org
    openssl rsa -in server.key.org -out server.key
    openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt
    ```

1. AWS コンソールにアクセスし、[Certificate Manager] を開きます。
1. [証明書のインポート]を押します。
1. [証明書本文]に `server.crt` の内容を貼り付けます。
1. [証明書のプライベートキー]に `server.key` の内容を貼り付けます。
1. [レビューとインポート]を押します。



### `Instance2` のスタックを作成する。

1. `parameters-app.json` ファイルをコピーして内容を変更します。
1. `aws s3 cp mastodon-app.template s3://[Bucket_for_Instance2]/[CloudFormation_templates]/`
1. `aws cloudformation create-stack --stack-name [Instance2 Stack Name] --region [REGION] --template-url [URL OF mastodon-app.template] --cli-input-json file://,parameters-app.json`
1. AWS コンソールにアクセスし、[Cloud Formation] を開きます。`CREATE_COMPLETE` になるまで待ちます。
1. [出力]タブの `MastodonInstanceHostName` の値をコピーします。
1. ドメインを管理する DNS サービスに `MastodonInstanceHostName` の値を CNAME レコードに登録します。
1. ブラウザで、`Instance2` の FQDN でアクセスできるようになるまで待ちます。 :coffee:


### Let's Encrypt の証明書を取得する。

1. `Instance2` の EC2 インスタンスにログインします。(踏み台の端末から SSH 転送します。)
1. certbot をインストールします。

    ```
    sudo su
    add-apt-repository ppa:certbot/certbot
    apt-get update
    apt-get install certbot
    ```

1. `certbot certonly --webroot -w /home/mastodon/[Instance2]/public -d [Instance2 Domain Name]`
1. 証明書をインポートします。

    ```
    aws acm import-certificate \
    --certificate-arn [Instance2 ACM ARN] \
    --certificate file:///etc/letsencrypt/live/[Instance2 Domain Name]/fullchain.pem \
    --private-key file:///etc/letsencrypt/live/[Instance2 Domain Name]/privkey.pem \
    --certificate-chain file:///etc/letsencrypt/live/[Instance2 Domain Name]/???????.pem
    ```
