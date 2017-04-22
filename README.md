# MastodonCloudFormation

Cloud Formation Template for Mastodon


## 使い方

1. S3 にアップロードする。

  ```
  aws s3 cp mastodon.template s3://[BUCKET]/[FOLDER]/
  ```
1. `parameters.json` をコピーして編集する。

  ```
  cp parameters.json ,parameters.json
  vi ,parameters.json
  ```

1. スタックを作成する。

  ```
  aws cloudformation create-stack --stack-name [STACK NAME] --region [REGION] --template-url [URL] --cli-input-json file://parameters.json
  ```

## 構成


* VPC を 1つ作成する。
* 3 つの Subnet を作成する。
  * Private Subnet 1
  * Private Subnet 2
  * Public Subnet
* RDS (PostgreSQL) を Private Subnet に作成する。

予定

* ElastiCache (Redis) を作成する。
* EC2 インスタンスを Public Subnet に作成する。
  * EC2 インスタンスに Mastodon を立てる。
* S3 バケット
  * 画像コンテンツ置き場
* CloudFront
* WAF




## parameters.json

TODO
