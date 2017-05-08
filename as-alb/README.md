# MastodonCloudFormation (Auto Scaling & Application Load Balancing)

Auto Scaling と Application Load Balancer を組み込んだ、Mastodon の Cloud Formation テンプレートです。



## 構成

本テンプレートで構築される AWS リソースの構成です。

![構成図](https://s3.amazonaws.com/public-nv/mastodon-github/as-alb/diagram.png)



## 事前準備

### AWS Certificate Manager の準備

正規の認証局から取得、又は生成したサーバー証明書を AWS Console などで、Certificate Manager に登録します。
[Let's Encrypt](https://letsencrypt.org/) を使う場合は「Let's Encrypt を使う」の項目を参照してください。


#### オレオレ証明書の作成手順

サーバーのホスト名(FQDN) が固まってない段階で HTTPS 接続を試すための、オレオレ証明書を作成する手順を示します。**サービス開始時にはこの方法で生成した証明書を使わないでください。**

```
openssl genrsa -des3 -out server.key 2048
openssl req -new -key server.key -out server.csr
cp server.key server.key.org
openssl rsa -in server.key.org -out server.key
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt

# server.crt と server.key を登録する
```


### S3 の準備

下記に示す S3 バケットを作成します。

* Mastodon コンテンツ (画像ファイルなど) 置き場。
  * 専用のバケットを作成することをお勧めします。
* Load Balancer アクセスログ置き場。
  * 専用のバケットを作成することをお勧めします。
  * バケットのリージョンと環境を構築するリージョンを合わせてください。
* ビルド済み Mastodon パッケージ置き場。
  * 専用のバケットを作成する必要はありません。


### メールサーバの準備

[Mailgun](https://www.mailgun.com/) 、[SparkPost](https://www.sparkpost.com/) および AWS の [SES](https://aws.amazon.com/jp/ses/) といった任意のメールサーバーが利用できます。



## CloudFormation スタックの作成

CloudFormation テンプレートは、インフラ部分 (mastodon-infra.template) とアプリケーション部分 (mastodon-app.template) の2つに分かれています。AWS CLI を使う方法で説明します。


### インフラスタックの構築

1. `parameters-infra.json` をコピーして編集します。設定内容は「テンプレートパラメータ」の項目を参照してください。
  
  ```
  cp parameters-infra.json ,parameters-infra.json
  # ,parameters-infra.json を編集
  ```
  
1. S3 の適当な場所に `mastodon-infra.template` をアップロードします。
1. インフラスタックを作成します。いくつかのリソースにはスタック名を先頭に付与します。同じリージョンに複数の Mastodon を起動することができます。
  
  ```
  aws cloudformation create-stack --stack-name [INFRASTRUCTURE STACK NAME] --region [REGION] --template-url [URL OF mastodon-infra.template] --cli-input-json file://,parameters-infra.json
  ```
  
1. S3 のビルド済み Mastodon パッケージ置き場に、パッケージがアップロードされるのを待ちます。約 30 分かかります。
  * Mastodon のビルドは、踏み台サーバで行われます。踏み台サーバは「[STACK NAME]-Bastion」という名前のインスタンスです。状況を確認したい場合は踏み台サーバに SSH でログインして `/var/log/cloud-init-output.log` を確認します。`/var/log/cloud-init-output.log` に以下のような行がある場合、構築は失敗しています。
    
    ```
    2017-04-28 04:08:13,525 - util.py[WARNING]: Failed running /var/lib/cloud/instance/scripts/part-001 [2]
    ```

    `pip install` で失敗するケースが多いため、リトライすれば成功する場合があります。リトライする場合はログに書かれているスクリプト (上記の例であれば `/var/lib/cloud/instance/scripts/part-001`) をスーパーユーザーで実行してください。


#### 踏み台サーバの扱い

踏み台サーバは、以下の目的で利用しますので Terminate しないでください。通常は Stop 状態にしておきます。

* Mastodon を更新するとき。
* Mastodon の EC2 インスタンスへ SSH でログインするとき。



### アプリケーションスタックの構築

1. `parameters-app.json` をコピーして編集します。設定内容は「テンプレートパラメータ」の項目を参照してください。

  ```
  cp parameters-app.json ,parameters-app.json
  # ,parameters-app.json を編集
  ```
  
1. S3 の適当な場所に `mastodon-app.template` をアップロードします。
1. アプリケーションスタックを作成します。いくつかのリソースにはスタック名を先頭に付与します。同じリージョンに複数の Mastodon を起動することができます。インフラスタックとアプリケーションスタックは 1対1で作成するようにしてください。
  
  ```
  aws cloudformation create-stack --stack-name [APPLICATION STACK NAME] --region [REGION] --template-url [URL OF mastodon-app.template] --cli-input-json file://,parameters-app.json
  ```
  
1. 構築が完了するとアプリケーションスタックの Output に Load Balancer のホスト名が出力されます。このホスト名にアクセスして動作確認してください。
  * Mastodon の構築に成功すると EC2 インスタンスを再起動します。アクセスできるようになるまで 3分程度時間がかかります。
  * ドメインをお持ちの場合は、このホスト名をDNS の CNAME レコードに設定します。


#### Mastodon EC2 インスタンスへのログイン

Mastodon EC2 インスタンスには Public IP を設定しません。Mastodon EC2 インスタンスに SSH でログインする場合は、踏み台サーバを利用し、SSH 転送機能でログインします。

* TeraTerm を使う場合。
  1. 踏み台サーバにログインします。
  1. [Setup]→[SSH Forwarding] を実行します。
  1. [Add] を押します。
  1. [Forward local port] を選択し、適当なポート番号を設定します。[listen] は空のままにします。
  1. [to remote machine] に Mastodon EC2 インスタンスの Private IP を設定します。
  1. [port] は 22 にします。
  1. [OK] を押します。
  1. 別の TeraTerm ウィンドウで localhost の [Forward local port] に接続します。
* ssh コマンドを使う場合。
  1. `ssh -i [PRIVATE KEY] ubuntu@[BASTION] -L [LOCAL PORT]:[MASTODON PRIVATE IP]:22`
  1. 別の端末で `ssh -i [PRIVATE KEY] ubuntu@localhost -p [LOCAL PORT]`



## Let's Encrypt を使う

Let's Encrypt の証明書を使うための手順を示します。

1. Mastodon の Load Balancer のホスト名に、DNS の CNAME レコードを設定します。
1. Mastodon の EC2 インスタンスに SSH でログインします。AutoScaling で複数のインスタンスが動いている場合は、1台に絞ってから実施します。
  * 1台に絞らないと Let's Encrypt サーバと certbot の連携に失敗するおそれがあります。
1. certbot をインストールします。
  
  ```
  sudo su
  add-apt-repository ppa:certbot/certbot
  apt-get update
  apt-get install certbot
  ```
  
1. `certbot` を実行して証明書を作成します。
  
  ```
  certbot certonly --webroot -w /home/mastodon/live/public -d [DOMAIN NAME]
  ```
  
1. `/etc/letsencrypt/live/[DOMAIN NAME]` に最新の証明書を指すシンボリックリンクがありますので、SCP もしくは S3 経由で入手します。
  
  ```
  aws s3 cp /etc/letsencrypt/live/[DOMAIN NAME]/fullchain.pem s3://[BUCKET]/[FOLDER]/
  aws s3 cp /etc/letsencrypt/live/[DOMAIN NAME]/privkey.pem   s3://[BUCKET]/[FOLDER]/
  ```
  
1. AWS コンソールの Certificate Manager を開き、証明書の再インポートを実行します。
  * [Certificate body] に `fullchain.pem` の前半を設定します。
  * [Certificate private key] に `privkey.pem` 全文を設定します。
  * [Certificate chain] に `fullchain.pem` の後半を設定します。



## Mastodon の更新

Mastodon の更新は踏み台サーバで行います。

1. SSH で踏み台サーバにログインします。
1. スーパーユーザーになります。
1. `/home/mastodon/live` に移動します。
1. `git fetch` します。
  * 失敗する場合は `live` ディレクトリを削除して `git clone` しなおします。この場合 `.env.production` ファイルをバックアップしてください。`rake secret` でキーを変更してしまうとデータベースにアクセスできなくなります。
1. `git checkout` で最新のリリースタグに切り替えます。
1. データベースのマイグレーションを行います。
  
  ```
  RAILS_ENV=production bundle exec rails db:migrate
  ```
  
1. 静的コンテンツのプリコンパイルを行います。
  
  ```
  yarn install --pure-lockfile
  RAILS_ENV=production bundle exec rails assets:precompile
  ```
  
1. live ディレクトリのアーカイブを作成します。アーカイブのファイル名は、CloudFormation スタックを構築したときに設定した名前にします。
  
  ```
  cd ..
  tar cfz [PACKAGE NAME] live
  ```
  
1. S3 のパッケージファイル置き場にアップロードします。
  
  ```
  aws s3 cp [PACKAGE NAME] s3://[BUCKET]/[FOLDER]/
  ```
  
1. AutoScaling の最小インスタンス数を 2 にします。
1. Mastodon の EC2 インスタンスが 2つに増えたら、古い方を Terminate します。
1. AutoScaling の最小インスタンスを 1 に戻します。



## スタックの削除

Mastodon サービスを閉じる場合は、AWS コンソール、もしくは AWS CLI で、以下の順番で CloudFormation スタックを削除します。

1. アプリケーションスタックを先に削除します。
1. アプリケーションスタックが消滅しましたら、インフラスタックを削除します。
  * アプリケーションスタックが存在している間はインフラスタックは削除できません。

RDS のスナップショットやパラメータグループが残る場合がありますので、必要に応じて削除します。S3 のコンテンツ置き場やアクセスログ置き場は手動で削除します。



## テンプレートパラメータ

テンプレートファイルの設定項目について説明します。

### インフラ

#### コンテンツ置き場関係の設定

* ContentsAWSAccessKey
  * AWS のアクセスキーを指定します。
* ContentsAWSAccessSecret
  * AWS のシークレットキーを指定します。
* ContentsS3Bucket
  * コンテンツ置き場の S3 のバケット名を指定します。


#### ビルド済みパッケージ置き場関係の設定

* PackageS3Bucket
  * ビルド済みパッケージ置き場の S3 のバケット名を指定します。
* PackageS3Prefix
  * ビルド済みパッケージ置き場の S3 のフォルダ名を指定します。先頭と末尾にスラッシュ (/) はつけないでください。
* PackageName
  * ビルド済みパッケージのファイル名を指定します。


#### LoadBalancer アクセスログ置き場関係の設定

* LBAccessLogS3Bucket
  * LoadBalancer アクセスログ置き場の S3 のバケット名を指定します。バケットのリージョンは LoadBalancer と同じでなければなりません。
* LBAccessLogPrefix
  * LoadBalancer アクセスログ置き場の S3 のフォルダ名を指定します。先頭と末尾にスラッシュ (/) はつけないでください。


#### データベース関係の設定

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


#### Redis 関係の設定

* ElastiCacheNodeType
  * Redis インスタンスのインスタンスタイプを指定します。
  * デフォルト: "cache.t2.micro"
* ElastiCacheVersion
  * Redis のバージョンを指定します。
  * 有効な値: "3.2.4", "2.8.24", "2.8.23", "2.8.22", "2.8.21", "2.8.19", "2.8.6", "2.6.13"


#### EC2 関係の設定

* EC2KeyPair
  * EC2 キーペアの名前を指定します。SSH でログインするのに必要です。
* BastionInstanceAMI
  * 踏み台サーバの EC2 インスタンスの AMI を指定します。"Ubuntu Server 16.04 LTS (HVM), SSD Volume Type" の AMI を利用してください。
* BastionInstanceType
  * 踏み台サーバの EC2 インスタンスのインスタンスタイプを指定します。
    * デフォルト: "t2.micro"


#### Mastodon 関係の設定

* MastodonFQDN
  * Mastodon の完全なホスト名を指定します。


#### メール関係の設定

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


#### AWS リソース関係の設定

* SubnetAvailabilityZone1
  * サブネットの AvailabilityZone を指定します。
* SubnetAvailabilityZone2
  * サブネットの AvailabilityZone を指定します。
* Tag1Key
  * AWS リソースに付与するタグのキーです。
* Tag1Value
  * AWS リソースに付与するタグの値です。コストの算出に利用できます。


### アプリケーション

#### AWS リソース関係の設定

* InfraStackName
  * インフラスタックの名前を指定します。
* CertArn
  * サーバー証明書がインポートされている Certificate Manager の ARN を指定します。
* Tag1Key
  * AWS リソースに付与するタグのキーです。
* Tag1Value
  * AWS リソースに付与するタグの値です。コストの算出に利用できます。


#### EC2 関係の設定

* EC2KeyPair
  * EC2 キーペアの名前を指定します。SSH でログインするのに必要です。
* InstanceAMI
  * Mastodon サーバの EC2 インスタンスの AMI を指定します。"Ubuntu Server 16.04 LTS (HVM), SSD Volume Type" の AMI を利用してください。
* InstanceType
  * Mastodon サーバの EC2 インスタンスのインスタンスタイプを指定します。
    * デフォルト: "t2.micro"
      * 無料枠になるためこのインスタンスタイプにしていますが、メモリが不足するため安定稼動しません。[ここ](https://github.com/tootsuite/documentation/blob/master/Running-Mastodon/Resources-needed.md) を参考にインスタンスタイプを決めてください。
