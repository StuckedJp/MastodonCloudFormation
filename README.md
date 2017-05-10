# MastodonCloudFormation

Mastodon の Cloud Formation テンプレートです。


## 内容

### simple

EC2 インスタンスと RDS(Postgresql) と ElastiCache(Redis) で構築された、シンプルな構成のテンプレートです。以下の特徴があります。

* VPC 内にすべてのサーバを内包します。
* サブネットを分割し、インターネットにデータベースサーバを晒さないセキュアな構成です。
* Mastodon が稼動している EC2 インスタンスが直接インターネットからのアクセスを受け付けます。

![構成図](https://s3.amazonaws.com/public-nv/mastodon-github/simple.png)



### as-alb

EC2 インスタンスと RDS(Postgresql) と ElastiCache(Redis) で構築され、EC2 の前段に Auto Scaling と Application Load Balancer を置いた強固な構成のテンプレートです。以下の特徴があります。

* VPC 内にすべてのサーバを内包します。
* サブネットを分割し、インターネットにデータベースサーバを晒さないセキュアな構成です。
* Application Load Balancer が、EC2 に代わってインターネットからのアクセスを受け付けます。
* EC2 側の問題でサービスが死んだ場合、AutoScaling で自動復旧します。
* 負荷状況に応じて EC2 インスタンスを増減できます。

![構成図](https://s3.amazonaws.com/public-nv/mastodon-github/as-alb.png)


