# MastodonCloudFormation

Cloud Formation Template for Mastodon


## 使い方

### サーバー証明書の準備

正規の認証局が発行したサーバー証明書を取得します。 [Let's Encrypt](https://letsencrypt.org/) を使う場合は「Let's Encrypt を使う」の項目を参照してください。


#### オレオレ証明書の作成手順

サーバーのホスト名(FQDN) が固まってない段階で HTTPS 接続を試すための、オレオレ証明書を作成する手順を示します。**サービス開始時にはこの方法で生成した証明書を使わないでください。**

```
openssl genrsa -des3 -out server.key 2048
openssl req -new -key server.key -out server.csr
cp server.key server.key.org
openssl rsa -in server.key.org -out server.key
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt

# server.crt と server.key を使う
```


### S3 の準備

1. 本テンプレートは、CloudFormation テンプレート、およびサーバー証明書置き場として S3 バケットを 1 つ必要とします。CloudFormation スタック作成時のみ利用します。専用に作る必要はありません。バケットのリージョンもどこでもかまいません。
1. S3 にテンプレートをアップロードします。

  ```
  aws s3 cp mastodon.template s3://[BUCKET]/[FOLDER]/
  ```

1. S3 にサーバー証明書をアップロードします。適当な名前でフォルダを作成し、サーバー証明書ファイルは2つとも同じフォルダに置いてください。

  ```
  aws s3 cp server.crt s3://[BUCKET]/[FOLDER]/
  aws s3 cp server.key s3://[BUCKET]/[FOLDER]/
  ```


### メールサーバの準備

任意のメールサーバーが利用できます。[Mailgun](https://www.mailgun.com/) および、[SparkPost](https://www.sparkpost.com/) が無料で送信できる件数が多いのでお勧めです。
SES は登録したメールアドレスにしか送れませんので、Mastodon のように不特定の宛先にメールを送るシステムには適しません。


### CloudFormation スタックの作成

AWS CLI を使う方法について説明します。

1. `parameters.json` をコピーして編集します。設定内容は「テンプレートパラメータ」の項目を参照してください。

  ```
  cp parameters.json ,parameters.json
  # ,parameters.json を編集
  ```

1. CloudFormation スタックを作成します。いくつかのリソースにはスタック名を先頭に付与します。同じリージョンに複数の Mastodon を起動することができます。

  ```
  aws cloudformation create-stack --stack-name [STACK NAME] --region [REGION] --template-url [URL] --cli-input-json file://,parameters.json
  ```


### 構築の確認

Mastodon サービスが起動する前に、CloudFormation スタックは `CREATE_COMPLETE` になります。また、Mastodon のセットアップが失敗しても `CREATE_COMPLETE` になりますので、EC2 インスタンスにログインし、`/var/log/cloud-init-output.log` を確認します。

EC2 インスタンスに ElasticIP がアサインされた直後であれば、`tail -f` でログが流れているのを確認できます。

Mastodon の構築に成功すると EC2 インスタンスを再起動します。


#### 失敗した場合

`/var/log/cloud-init-output.log` に以下のような行がある場合、構築は失敗しています。

```
2017-04-28 04:08:13,525 - util.py[WARNING]: Failed running /var/lib/cloud/instance/scripts/part-001 [2]
```

ただし、`pip install` で失敗するケースが多いため、リトライすれば成功する場合があります。リトライする場合はログに書かれているスクリプト (上記の例であれば `/var/lib/cloud/instance/scripts/part-001`) をスーパーユーザーで実行してください。

テンプレートパラメータに誤りがあった場合は、スタックを破棄して再作成してください。


## Let's Encrypt を使う

Let's Encrypt の証明書を使うための手順を示します。

1. Mastodon の EC2 インスタンスの IP アドレスに、DNS の A レコードを設定します。
1. Mastodon の EC2 インスタンスに SSH でログインします。
1. certbot をインストールします。

  ```
  sudo su
  add-apt-repository ppa:certbot/certbot
  apt-get update
  apt-get install certbot
  ```

1. Nginx を停止します。

  ```
  systemctl stop nginx
  ```

1. certbot を実行して証明書を作成します。

  ```
  certbot certonly --standalone -d [DOMAIN NAME]
  ```

1. `/etc/nginx/sites-available/[DOMAIN NAME]` を編集して Let's Encrypt の証明書を利用するように変更します。

  ```
  ssl_certificate     /etc/letsencrypt/live/[DOMAIN NAME]/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/[DOMAIN NAME]/privkey.pem;
  ```

1. Nginx を再開します。

  ```
  systemctl start nginx
  ```

1. Let's Encrypt の証明書は 90 日で期限が切れます。自動更新するようにします。`/home/mastodon/certbot-renew` という名前で以下のようなスクリプトを作成します。

  ```
  #! /bin/bash
  systemctl stop nginx
  certbot renew --dry-run
  systemctl start nginx
  ```

1. `/etc/crontab` を設定します。以下の例では、2ヶ月に1回更新します。

  ```
  0 18 1 1-12/2 *      root    /home/mastodon/certbot-renew
  ```



## スタックの削除

Mastodon サービスを閉じる場合は、AWS コンソール、もしくは AWS CLI で CloudFormation スタックを削除します。
コンテンツ置き場の S3 のバケットは、中身が空の場合に限り CloudFormation で削除されます。バケットが残った場合は個別に削除してください。
RDS のスナップショットやパラメータグループも残る場合がありますので、必要に応じて削除します。



## 構成

AWS リソースの構成です。

![物理構成図](https://s3.amazonaws.com/public-nv/mastodon-github/physical-diagram.png)




## テンプレートパラメータ

テンプレートファイルの設定項目について説明します。

### サーバー証明書関係の設定

* CertS3Bucket
  * サーバー証明書が置かれている S3 のバケット名を指定します。
* CertS3Folder
  * サーバー証明書が置かれている S3 のフォルダ名を指定します。先頭と末尾にはスラッシュ記号を入れないでください。
* CertS3CertName
  * サーバー証明書の証明書ファイルの名前を指定します。
* CertS3KeyName
  * サーバー証明書のキーファイルの名前を指定します。


### コンテンツ置き場関係の設定

* ContentsAWSAccessKey
  * AWS のアクセスキーを指定します。
* ContentsAWSAccessSecret
  * AWS のシークレットキーを指定します。
* ContentsS3Bucket
  * コンテンツ置き場の S3 のバケット名を指定します。


### データベース関係の設定

* DBEngineVersion
  * Postgresql のバージョンを指定します。
    * 有効な値: "9.6.1", "9.5.4", "9.5.2", "9.4.9", "9.4.7", "9.3.14", "9.3.12"
* DBInstanceClass
  * DB インスタンスのインスタンスタイプを指定します。
    * デフォルト: "db.t2.micro"
* DBLicenseModel
  * Postgresql のライセンスモデルを指定します。"postgresql-license" のみ指定できます。
* DBStorageType
  * DB インスタンスのストレージタイプを指定します。インスタンスタイプによって変わります。
    * 有効な値: "standard", "gp2", "io1"
    * デフォルト: "standard"
* DBName
  * データベースのスキーマ名を指定します。
* DBMasterUsername
  * データベースのユーザー名を指定します。
* DBMasterUserPassword
  * データベースの `DBMasterUsername` で指定したユーザーのパスワードを指定します。

### Redis 関係の設定

* ElastiCacheNodeType
  * Redis インスタンスのインスタンスタイプを指定します。
  * デフォルト: "cache.t2.micro"
* ElastiCacheVersion
  * Redis のバージョンを指定します。
  * 有効な値: "3.2.4", "2.8.24", "2.8.23", "2.8.22", "2.8.21", "2.8.19", "2.8.6", "2.6.13"


### EC2 関係の設定

* EC2KeyPair
  * EC2 キーペアの名前を指定します。SSH でログインするのに必要です。
* InstanceAMI
  * EC2 インスタンスの AMI を指定します。"Ubuntu Server 16.04 LTS (HVM), SSD Volume Type" の AMI を利用してください。
* InstanceType
  * EC2 インスタンスのインスタンスタイプを指定します。
    * デフォルト: "t2.micro"
* MastodonFQDN
  * Mastodon の完全なホスト名を指定します。


### メール関係の設定

* SMTPHostName
  * メール送信サーバーのホスト名を指定します。
* SMTPHostPort	
  * メール送信サーバーのポート番号を指定します。
    * デフォルト: 587
* SMTPUserName
  * メール送信サーバーの認証で使用するユーザー名を指定します。
* SMTPPassword
  * メール送信サーバーの認証で使用するユーザーのパスワードを指定します。
* SMTPSenderAddress
  * メールの送信者のメールアドレスを指定します。


### AWS リソース関係の設定

* SubnetAvailabilityZone1
  * プライベートサブネットの AvailabilityZone を指定します。
* SubnetAvailabilityZone2
  * プライベートサブネットの AvailabilityZone を指定します。
* Tag1Key
  * AWS リソースに付与するタグのキーです。
* Tag1Value
  * AWS リソースに付与するタグの値です。コストの算出に利用できます。



## 残件

* できれば
  * ELB
  * Auto Scaling
  * ElasticBeanstalk
