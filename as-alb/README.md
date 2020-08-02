# CloudFormation template for Mastodon (Auto Scaling & Application Load Balancing)

Auto Scaling と Application Load Balancer を組み込んだ、Mastodon の Cloud Formation テンプレートです。



## 構成

本テンプレートで構築される AWS リソースの構成です。

![構成図](https://s3.amazonaws.com/public-nv/mastodon-github/as-alb.png)



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
  * 下記の通り CORS の設定を行います。
    ```xml
    <?xml version="1.0" encoding="UTF-8"?>  
    <CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">  
    <CORSRule>  
        <AllowedOrigin>*</AllowedOrigin>  
        <AllowedMethod>GET</AllowedMethod>  
        <AllowedMethod>HEAD</AllowedMethod>  
        <MaxAgeSeconds>3000</MaxAgeSeconds>  
        <AllowedHeader>*</AllowedHeader>  
    </CORSRule>  
    </CORSConfiguration>
    ```
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

1. 以下のコマンドでインフラスタックを作成します。いくつかのリソースにはスタック名を先頭に付与します。同じリージョンに複数の Mastodon を起動することができます。
  
    ```
    aws cloudformation deploy \
    --region [REGION] \
    --stack-name [INFRASTRUCTURE STACK NAME] \
    --template-file mastodon-infra.template.yaml \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        Tag1Key=.... \
        Tag1Value=.... \
        Tag2Key=.... \
        Tag2Value=.... \
        SubnetAvailabilityZone=....,.... \
        DBInstanceClass=db.t2.micro \
        DBName=mastodon \
        DBEngineVersion=11.5 \
        DBLicenseModel=postgresql-license \
        DBMasterUsername=mastodon \
        DBMasterUserPassword=........ \
        DBStorageType=standard \
        DBSnapshotIdentifier= \
        ElastiCacheNodeType=cache.t2.micro \
        ElastiCacheVersion=5.0.5 \
        EC2KeyPair=.... \
        NATInstanceType=t3.nano \
        ContentsAWSAccessKey=........ \
        ContentsAWSAccessSecret=............ \
        LBAccessLogS3Bucket=.... \
        LBAccessLogPrefix=....
    ```
  
1. インフラスタックの構築が完了するのを待ちます。



### 踏み台スタックの構築

1. OpsWorks を使います。Cookbook を適当な S3 バケットにアップロードします。
    ```
    cd chef/chef-repo/cookbooks/
    tar cfz ../cookbooks.tgz *
    aws s3 cp ../cookbooks.tgz s3://[COOKBOOK BUCKET]/[COOKBOOK KEY]
    cd ../../..
    ```
1. 以下のコマンドで踏み台スタックを作成します。いくつかのリソースにはスタック名を先頭に付与します。
    ```
    aws cloudformation deploy \
    --region [REGION] \
    --stack-name [BASTION STACK NAME] \
    --template-file mastodon-bastion-opsworks.template.yaml \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        Tag1Key=.... \
        Tag1Value=.... \
        Tag2Key=.... \
        Tag2Value=.... \
        InfraStackName=[INFRASTRUCTURE STACK NAME] \
        CookbookUrl=https://[COOKBOOK URL] \
        MastodonFQDN=.... \
        MastodonVersion=v3.0.1 \
        SecretKeyBase= \
        OtpSecret= \
        UseExistingDB=false \
        BastionInstanceType=t3.small \
        EC2KeyPair=.... \
        PackageS3Bucket=.... \
        PackageS3Prefix=.... \
        PackageName=.... \
        ContentsS3Bucket=.... \
        ContentsAWSAccessKey=.... \
        ContentsAWSAccessSecret=.... \
        SMTPHostName=.... \
        SMTPHostPort=587 \
        SMTPUserName=.... \
        SMTPPassword=.... \
        SMTPSenderAddress=....

    aws cloudformation create-stack --stack-name [BASTION STACK NAME] --region [REGION] --template-url [URL OF mastodon-bastion.template] --cli-input-json file://,parameters-bastion.json
    ```

1. S3 のビルド済み Mastodon パッケージ置き場に、パッケージがアップロードされるのを待ちます。約 30 分かかります。
    * Mastodon のビルドは、踏み台サーバで行われます。踏み台サーバは「[STACK NAME]-Bastion」という名前のインスタンスです。状況を確認したい場合は踏み台サーバに SSH でログインして `/var/log/cloud-init-output.log` を確認します。`/var/log/cloud-init-output.log` に以下のような行がある場合、構築は失敗しています。
    
        ```
        2017-04-28 04:08:13,525 - util.py[WARNING]: Failed running /var/lib/cloud/instance/scripts/part-001 [2]
        ```

      リトライすれば成功する場合があります。リトライする場合はログに書かれているスクリプト (上記の例であれば `/var/lib/cloud/instance/scripts/part-001`) をスーパーユーザーで実行してください。Mastodon ユーザーの作成や`git clone`するところは、再実行するとエラーになりますので、エラー発生箇所に応じてスクリプトの一部をコメントアウトする必要があります。


#### 踏み台サーバの扱い

踏み台サーバは、以下の目的で利用しますので Terminate しないでください。通常は Stop 状態にしておきます。

* Mastodon を更新するとき。
* Mastodon の EC2 インスタンスへ SSH でログインするとき。



### アプリケーションスタックの構築

1. アプリケーションスタックを作成します。いくつかのリソースにはスタック名を先頭に付与します。同じリージョンに複数の Mastodon を起動することができます。インフラスタックとアプリケーションスタックは 1対1で作成するようにしてください。

    ```
    aws cloudformation deploy \
    --region us-west-2 \
    --stack-name [APPLICATION SERVER STACK NAME] \
    --template-file mastodon-app-opsworks.template.yaml \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        Tag1Key=.... \
        Tag1Value=.... \
        Tag2Key=.... \
        Tag2Value=.... \
        InfraStackName=[INFRASTRUCTURE STACK NAME] \
        CookbookUrl=https://[COOKBOOK URL] \
        MastodonFQDN=.... \
        InstanceType=t3.small \
        EC2KeyPair=.... \
        PackageS3Bucket=.... \
        PackageS3Prefix=.... \
        PackageName=.... \
        ContentsS3Bucket=.... \
        LBAccessLogS3Bucket=.... \
        LBAccessLogPrefix=.... \
        CertArn=....
    ```

1. 構築が完了するとアプリケーションスタックの Output に Load Balancer のホスト名が出力されます。
    * ドメインをお持ちの場合は、このホスト名をDNS の CNAME レコードに設定します。




### アプリケーションインスタンススタックの構築

1. アプリケーションインスタンススタックを作成します。

    ```
    aws cloudformation deploy \
    --region us-east-1 \
    --stack-name [APPLICATION INSTANCE STACK NAME] \
    --template-file mastodon-app-instance.template.yaml \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        Tag1Key=.... \
        Tag1Value=.... \
        Tag2Key=.... \
        Tag2Value=.... \
        InfraStackName=[INFRASTRUCTURE STACK NAME] \
        AppStackName=[APPLICATION SERVER STACK NAME] \
        InstanceType=.... \
        EC2KeyPair=....
    ```

1. 構築が完了すると Load Balancer のホスト名で Mastodon のサービスが起動します。アクセスして動作確認します。




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
    1. `$HOME/.ssh/config` ファイルを以下のように編集します。

    ```
    Host aws-v-u
        HostName [BASTION]
        IdentityFile [PRIVATE KEY]
        User ubuntu
        ServerAliveInterval 60

    Host aws-v-u-p
        HostName [MASTODON PRIVATE IP]
        IdentityFile [PRIVATE KEY]
        User ubuntu
        ProxyCommand ssh -W %h:%p aws-v-u
        ServerAliveInterval 60

    ```

    1. `ssh aws-v-u` で踏み台にログインできます。
    1. `ssh aws-v-u-p` で Web サーバーにログインできます。



## Let's Encrypt を使う

Let's Encrypt の証明書を使うための手順を示します。

1. Mastodon の Load Balancer のホスト名に、DNS の CNAME レコードを設定します。
1. Mastodon の EC2 インスタンスに SSH でログインします。AutoScaling で複数のインスタンスが動いている場合は、1台に絞ってから実施します。
    * 1台に絞らないと Let's Encrypt サーバと certbot の連携に失敗するおそれがあります。
1. `certbot` を実行して証明書を作成します。
    ```
    certbot certonly --webroot -w /home/mastodon/[DOMAIN NAME]/public -d [DOMAIN NAME]
    ```
1. 証明書をインポートします。
    ```
    aws acm import-certificate \
    --region [Region] \
    --certificate-arn [ACM ARN] \
    --certificate file:///etc/letsencrypt/live/[DOMAIN NAME]/cert.pem \
    --private-key file:///etc/letsencrypt/live/[DOMAIN NAME]/privkey.pem \
    --certificate-chain file:///etc/letsencrypt/live/[DOMAIN NAME]/chain.pem
    ```
  



## Mastodon の更新

Mastodon の更新は踏み台サーバで行います。

1. SSH で踏み台サーバにログインします。
1. スーパーユーザーになります。
1. `/home/mastodon/[DOMAIN NAME]` に移動します。
1. `git fetch` します。
    * 失敗する場合は `/home/mastodon/[DOMAIN NAME]` ディレクトリを削除して `git clone` しなおします。この場合 `.env.production` ファイルをバックアップしてください。`rake secret` でキーを変更してしまうとデータベースアクセスでエラーになります。
1. `git checkout` で最新のリリースタグに切り替えます。
1. Mastodon のリリースノートに従って作業を行います。
1. `/home/mastodon/[DOMAIN NAME]` ディレクトリのアーカイブを作成します。アーカイブのファイル名は、CloudFormation スタックを構築したときに設定した名前にします。
    ```
    cd ..
    tar cfz [PACKAGE NAME] [DOMAIN NAME]
    ```
1. S3 のパッケージファイル置き場にアップロードします。
    ```
    aws s3 cp [PACKAGE NAME] s3://[BUCKET]/[FOLDER]/
    ```
1. AutoScaling の最小インスタンス数を 2 にします。
1. Mastodon の EC2 インスタンスが 2つに増えたら、AutoScaling の最小インスタンスを 1 に戻します。
1. 10 分後に古い方が Terminate します。



## スタックの削除

Mastodon サービスを閉じる場合は、AWS コンソール、もしくは AWS CLI で、以下の順番で CloudFormation スタックを削除します。

1. アプリケーションスタックを先に削除します。
1. 踏み台スタックを削除します。
1. アプリケーションスタック、踏み台スタックが消滅しましたら、インフラスタックを削除します。
    * アプリケーションスタック、踏み台スタックが存在している間はインフラスタックは削除できません。

RDS のスナップショットやパラメータグループが残る場合がありますので、必要に応じて削除します。S3 のコンテンツ置き場やアクセスログ置き場は手動で削除します。



## テンプレートパラメータ

テンプレートファイルの設定項目について説明します。

### インフラ

#### LoadBalancer アクセスログ置き場関係の設定

* LBAccessLogS3Bucket
  * LoadBalancer アクセスログ置き場の S3 のバケット名を指定します。バケットのリージョンは LoadBalancer と同じでなければなりません。
* LBAccessLogPrefix
  * LoadBalancer アクセスログ置き場の S3 のフォルダ名を指定します。先頭と末尾にスラッシュ (/) はつけないでください。


#### データベース関係の設定

* DBEngineVersion
  * Postgresql のバージョンを指定します。
* DBInstanceClass
  * DB インスタンスのインスタンスタイプを指定します。
    * デフォルト: "db.t2.micro"
* DBLicenseModel
  * Postgresql のライセンスモデルを指定します。"postgresql-license" のみ指定できます。
* DBStorageType
  * DB インスタンスのストレージタイプを指定します。インスタンスタイプによって変わります。
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


#### EC2 関係の設定

* EC2KeyPair
  * EC2 キーペアの名前を指定します。SSH でログインするのに必要です。
* NATInstanceType
  * NAT インスタンスのインスタンスタイプを指定します。
    * デフォルト: "t2.micro"


#### AWS リソース関係の設定

* SubnetAvailabilityZone
  * サブネットの AvailabilityZone を指定します。
* Tag1Key, Tag2Key
  * AWS リソースに付与するタグのキーです。
* Tag1Value, Tag2Value
  * AWS リソースに付与するタグの値です。コストの算出に利用できます。


### 踏み台

#### AWS リソース関係の設定

* InfraStackName
  * インフラスタックの名前を指定します。
* Tag1Key, Tag2Key
  * AWS リソースに付与するタグのキーです。
* Tag1Value, Tag2Value
  * AWS リソースに付与するタグの値です。コストの算出に利用できます。

#### Mastodon 関係の設定

* MastodonFQDN
  * Mastodon の完全なホスト名を指定します。
* MastodonVersion
  * Mastodon のリリースタグ名を指定します。master ブランチの最新を使う場合は空文字列を指定します。
* SecretKeyBase
  * 初期構築時は空文字列にします。
* OtpSecret
  * 初期構築時は空文字列にします。
* UseExistingDB
  * 初期構築時は false にします。

#### EC2 関係の設定

* EC2KeyPair
  * EC2 キーペアの名前を指定します。SSH でログインするのに必要です。
* BastionInstanceAMI
  * 踏み台サーバの EC2 インスタンスの AMI を指定します。"Ubuntu Server 18.04 LTS (HVM), SSD Volume Type" の AMI を利用してください。
* BastionInstanceType
  * 踏み台サーバの EC2 インスタンスのインスタンスタイプを指定します。
    * デフォルト: "t2.micro"
      * 無料枠になるためこのインスタンスタイプにしていますが、メモリ不足により `yarn install` がいつまでも完了しない場合があります。その場合は 1 ランク上のインスタンスタイプに切り替えてみてください。

#### ビルド済みパッケージ置き場関係の設定

* PackageS3Bucket
  * ビルド済みパッケージ置き場の S3 のバケット名を指定します。
* PackageS3Prefix
  * ビルド済みパッケージ置き場の S3 のフォルダ名を指定します。先頭と末尾にスラッシュ (/) はつけないでください。
* PackageName
  * ビルド済みパッケージのファイル名を指定します。

#### コンテンツ置き場関係の設定

* ContentsAWSAccessKey
  * AWS のアクセスキーを指定します。
* ContentsAWSAccessSecret
  * AWS のシークレットキーを指定します。
* ContentsS3Bucket
  * コンテンツ置き場の S3 のバケット名を指定します。

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


### アプリケーション

インフラスタックのリソースを複数の Mastodon インスタンスで共有できるよう、インフラスタックと同じ設定項目がいくつか存在します。

#### AWS リソース関係の設定

* InfraStackName
  * インフラスタックの名前を指定します。
* CertArn
  * サーバー証明書がインポートされている Certificate Manager の ARN を指定します。
* Tag1Key, Tag2Key
  * AWS リソースに付与するタグのキーです。
* Tag1Value, Tag2Value
  * AWS リソースに付与するタグの値です。コストの算出に利用できます。

#### Mastodon 関係の設定

* MastodonFQDN
  * Mastodon の完全なホスト名を指定します。

#### ビルド済みパッケージ置き場関係の設定

* PackageS3Bucket
  * ビルド済みパッケージ置き場の S3 のバケット名を指定します。
* PackageS3Prefix
  * ビルド済みパッケージ置き場の S3 のフォルダ名を指定します。先頭と末尾にスラッシュ (/) はつけないでください。
* PackageName
  * ビルド済みパッケージのファイル名を指定します。

#### コンテンツ置き場関係の設定

* ContentsS3Bucket
  * コンテンツ置き場の S3 のバケット名を指定します。


#### LoadBalancer アクセスログ置き場関係の設定

* LBAccessLogS3Bucket
  * LoadBalancer アクセスログ置き場の S3 のバケット名を指定します。バケットのリージョンは LoadBalancer と同じでなければなりません。
* LBAccessLogPrefix
  * LoadBalancer アクセスログ置き場の S3 のフォルダ名を指定します。先頭と末尾にスラッシュ (/) はつけないでください。


#### EC2 関係の設定

* EC2KeyPair
  * EC2 キーペアの名前を指定します。Mastodon サーバ に SSH でログインするのに必要です。
* InstanceAMI
  * Mastodon サーバの EC2 インスタンスの AMI を指定します。"Ubuntu Server 16.04 LTS (HVM), SSD Volume Type" の AMI を利用してください。
* InstanceType
  * Mastodon サーバの EC2 インスタンスのインスタンスタイプを指定します。
    * デフォルト: "t2.micro"
      * 無料枠になるためこのインスタンスタイプにしていますが、メモリが不足するため安定稼動しません。[ここ](https://github.com/tootsuite/documentation/blob/master/Running-Mastodon/Resources-needed.md) を参考にインスタンスタイプを決めてください。
