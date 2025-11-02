export type ParamsType = {
  // 環境名
  envName: string;
  // AWS 設定
  aws: {
    // AWS リージョン
    region: string;
  };
  // S3 設定
  s3: {
    bucket: {
      // コンテンツ配信バケット
      contents: string;
      // バックヤードバケット
      backyard: string;
      // ログバケット
      log: string;
    };
  };
  vpc: {
    // VPC CIDR。通常は "10.0.0.0/16"
    cidr: string;
  };
  nat: {
    // NAT のインスタンスタイプ。通常は "t3a.nano"
    instanceType: string;
  };
  domain: {
    // ドメイン名 (Route53 ホストゾーン)
    name: string;
    // Mastodon のホスト名。null 設定可能
    hostName: string;
    // コンテンツ配信サーバーのホスト名。
    attachmentHost: string;
  };
  node: {
    // Node.js のバージョン
    version: string;
  };
  // RDS 設定
  rds: {
    // スナップショットID。スナップショットがない場合は null。
    snapshotId: string;
    // ストレージ容量
    storageGB: number;
    // データベース名
    databaseName: string;
    // ユーザー名
    userName: string;
  };
  bastion: {
    // 踏み台の AMI。AMI は https://cloud-images.ubuntu.com/locator/ec2/ から検索できる。
    ami: string;
  };
  // Mastodon サーバーの設定
  app: {
    // Mastodon サーバーの AMI。AMI は https://cloud-images.ubuntu.com/locator/ec2/ から検索できる。
    ami: string;
    // ストレージ容量
    storageGB: number;
    // アクセスログのプリフィックス
    accessLogPrefix: string;
    // Mastodon 設定の MASTODON_VERSION_METADATA
    versionMetadata: string;
    // Mastodon 設定の SECRET_KEY_BASE
    secretKeyBase: string;
    // Mastodon 設定の OTP_SECRET
    otpSecret: string;
    activeRecord: {
      encryption: {
        // Mastodon 設定の ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY
        deterministicKey: string;
        // Mastodon 設定の ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT
        keyDerivationSalt: string;
        // Mastodon 設定の ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY
        primaryKey: string;
      };
    };
  };
  // Mastodon ソースの設定
  mastodon: {
    git: {
      // git の URL
      url: string;
      // ブランチもしくはタグ
      tag: string;
    };
  };
  mail: {
    // メールの送信元アドレス
    fromAddress: string;
    smtp: {
      // SMTP サーバー名
      hostName: string;
      // SMTP サーバーポート
      port: number;
      // SMTP サーバーユーザー名
      userName: string;
      // SMTP サーバーパスワード
      password: string;
    };
  };
};
