import {
  Vpc,
  SecurityGroup,
  Peer,
  Port,
  InstanceType,
  InstanceClass,
  InstanceSize,
  BlockDeviceVolume,
  SubnetType,
} from 'aws-cdk-lib/aws-ec2';
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { CfnCacheCluster } from 'aws-cdk-lib/aws-elasticache';
import { DatabaseInstance } from 'aws-cdk-lib/aws-rds';

export class BastionStack extends Construct {
  constructor(
    scope: Construct,
    vpc: Vpc,
    contentBucket: Bucket,
    backyardBucket: Bucket,
    dbSecrets: Secret,
    dbInstance: DatabaseInstance,
    cacheCluster: CfnCacheCluster,
  ) {
    super(scope, 'bastion');

    // SecurityGroup
    const securityGroup = new SecurityGroup(this, 'mastodon-bastion-security-group', {
      vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22));
    securityGroup.addIngressRule(Peer.anyIpv6(), Port.tcp(22));

    // IAM Role
    const role = new Role(this, 'mastodon-bastion-role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      inlinePolicies: {
        codeBuildServicePolicies: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:*'],
              resources: [`${contentBucket.bucketArn}`],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:*'],
              resources: [`${contentBucket.bucketArn}/*`],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:*'],
              resources: [`${backyardBucket.bucketArn}`],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:*'],
              resources: [`${backyardBucket.bucketArn}/*`],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['secretsmanager:*'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      `apt-get update`,
      `apt-get upgrade -y`,
      `DEBIAN_FRONTEND=noninteractive apt-get install -y git build-essential curl wget gnupg apt-transport-https lsb-release ca-certificates postgresql-client unzip jq imagemagick ffmpeg libpq-dev libxml2-dev libxslt1-dev file git-core g++ libprotobuf-dev protobuf-compiler pkg-config gcc autoconf bison build-essential libssl-dev libyaml-dev libreadline6-dev zlib1g-dev libncurses5-dev libffi-dev libgdbm-dev libidn11-dev libicu-dev libjemalloc-dev`,
      // Redis client
      `curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg`,
      `echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/redis.list`,
      `apt-get update`,
      `apt-get install -y redis-tools`,
      // Node.js
      `mkdir -p /etc/apt/keyrings`,
      `curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg`,
      `NODE_MAJOR=16`,
      `echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list`,
      `apt-get update`,
      `apt-get install -y nodejs`,
      // Yarn
      `corepack enable`,
      `yarn set version classic`,
      // AWS CLI
      `cd /root`,
      `curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"`,
      `unzip awscliv2.zip`,
      `./aws/install`,
      // User add
      `useradd --create-home mastodon`,
      // rbenv
      `git clone https://github.com/rbenv/rbenv.git /usr/local/rbenv`,
      `cd /usr/local/rbenv`,
      `src/configure`,
      `make -C src`,
      `echo 'export RBENV_ROOT="/usr/local/rbenv"' >> /etc/profile`,
      `echo 'export PATH="/usr/local/rbenv/bin:$PATH"' >> /etc/profile`,
      `echo 'eval "$(rbenv init -)"' >> /etc/profile`,
      `source /etc/profile`,
      `git clone https://github.com/rbenv/ruby-build.git /usr/local/rbenv/plugins/ruby-build`,
      `RUBY_CONFIGURE_OPTS=--with-jemalloc bash -c "rbenv install ${process.env.RUBY_VERSION}"`,
      `rbenv global ${process.env.RUBY_VERSION}`,
      `gem install bundler --no-document`,
      // Mastodon
      `cd /home/mastodon`,
      `sudo -u mastodon git clone ${process.env.MASTODON_GIT_URL} mastodon`,
      `cd mastodon`,
      `sudo -u mastodon git checkout $(sudo -u mastodon git tag -l | grep -v 'rc[0-9]*$' | sort -V | tail -n 1)`,
      `sudo -u mastodon /usr/local/rbenv/shims/bundle config deployment 'true'`,
      `sudo -u mastodon /usr/local/rbenv/shims/bundle config without 'development test'`,
      `sudo -u mastodon /usr/local/rbenv/shims/bundle install -j$(getconf _NPROCESSORS_ONLN)`,
      `sudo -u mastodon yarn install --pure-lockfile`,
      // Retreve Secrets
      `cd /home/mastodon/mastodon`,
      `SECRET_ID=${dbSecrets.secretArn}`,
      'JSON=$(aws secretsmanager get-secret-value --secret-id ${SECRET_ID} | jq -cM ".SecretString | fromjson")',
      process.env.RDS_SNAPSHOT_ID
        ? `DB_HOST=${dbInstance.dbInstanceEndpointAddress}`
        : 'DB_HOST=$(echo ${JSON} | jq -rM .host)',
      process.env.RDS_SNAPSHOT_ID
        ? `DB_PORT=${dbInstance.dbInstanceEndpointPort}`
        : 'DB_PORT=$(echo ${JSON} | jq -rM .port)',
      process.env.RDS_SNAPSHOT_ID
        ? `DB_NAME=${process.env.RDS_SNAPSHOT_DB_NAME}`
        : 'DB_NAME=$(echo ${JSON} | jq -rM .dbname)',
      process.env.RDS_SNAPSHOT_ID
        ? `DB_USER_NAME=${process.env.RDS_SNAPSHOT_DB_USER_NAME}`
        : 'DB_USER_NAME=$(echo ${JSON} | jq -rM .username)',
      process.env.RDS_SNAPSHOT_ID
        ? `DB_PASSWORD=${process.env.RDS_SNAPSHOT_DB_PASSWORD}`
        : 'DB_PASSWORD=$(echo ${JSON} | jq -rM .password)',
      process.env.MASTODON_SECRET_KEY_BASE
        ? `SECRET_KEY_BASE=${process.env.MASTODON_SECRET_KEY_BASE}`
        : 'SECRET_KEY_BASE=$(sudo -u mastodon RAILS_ENV=production /usr/local/rbenv/shims/bundle exec rake secret)',
      process.env.MASTODON_OTP_SECRET
        ? `OTP_SECRET=${process.env.MASTODON_OTP_SECRET}`
        : 'OTP_SECRET=$(sudo -u mastodon RAILS_ENV=production /usr/local/rbenv/shims/bundle exec rake secret)',
      // Configure
      `cd /home/mastodon/mastodon`,
      `sudo -u mastodon touch .env.production`,
      `echo 'LOCAL_DOMAIN=${process.env.MASTODON_FQDN}' >> .env.production`,
      'echo "DB_HOST=${DB_HOST}" >> .env.production',
      'echo "DB_PORT=${DB_PORT}" >> .env.production',
      'echo "DB_NAME=${DB_NAME}" >> .env.production',
      'echo "DB_USER=${DB_USER_NAME}" >> .env.production',
      'echo "DB_PASS=${DB_PASSWORD}" >> .env.production',
      `echo 'REDIS_HOST=${cacheCluster.attrRedisEndpointAddress}' >> .env.production`,
      `echo 'REDIS_PORT=${cacheCluster.attrRedisEndpointPort}' >> .env.production`,
      `echo 'SMTP_SERVER=${process.env.SMTP_SERVER}' >> .env.production`,
      `echo 'SMTP_PORT=${process.env.SMTP_PORT}' >> .env.production`,
      `echo 'SMTP_LOGIN=${process.env.SMTP_LOGIN}' >> .env.production`,
      `echo 'SMTP_PASSWORD=${process.env.SMTP_PASSWORD}' >> .env.production`,
      `echo 'SMTP_FROM_ADDRESS=${process.env.SMTP_FROM_ADDRESS}' >> .env.production`,
      `echo 'S3_ENABLED=true' >> .env.production`,
      `echo 'S3_BUCKET=${contentBucket.bucketName}' >> .env.production`,
      `echo 'AWS_ACCESS_KEY_ID=${process.env.AWS_ACCESS_KEY_ID}' >> .env.production`,
      `echo 'AWS_SECRET_ACCESS_KEY=${process.env.AWS_SECRET_ACCESS_KEY}' >> .env.production`,
      `echo 'S3_REGION=${process.env.AWS_REGION}' >> .env.production`,
      `echo 'S3_HOSTNAME=s3.dualstack.${process.env.AWS_REGION}.amazonaws.com' >> .env.production`,
      'echo "SECRET_KEY_BASE=${SECRET_KEY_BASE}" >> .env.production',
      `echo "OTP_SECRET=$OTP_SECRET"  >> .env.production`,
      `sudo -u mastodon RAILS_ENV=production /usr/local/rbenv/shims/bundle exec rake mastodon:webpush:generate_vapid_key >> .env.production`,
      `aws s3 cp .env.production s3://${backyardBucket.bucketName}/config/.env.production`,
    );
    // https://cloud-images.ubuntu.com/locator/ec2/
    const machineImage = ec2.MachineImage.genericLinux(
      {
        'us-east-1': 'ami-0a0e5d9c7acc336f1',
      },
      {
        userData,
      },
    );

    // Bastion
    new ec2.Instance(this, 'mastodon-bastion-instance', {
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM),
      keyPair: ec2.KeyPair.fromKeyPairName(this, 'mastodon-bastion-instance-key-pair', process.env.BASTON_KEY_PAIR_NAME!),
      vpc,
      machineImage,
      securityGroup,
      vpcSubnets: vpc.selectSubnets({ subnetType: SubnetType.PUBLIC }),
      role,
      blockDevices: [
        {
          deviceName: '/dev/sda1',
          volume: BlockDeviceVolume.ebs(20),
        },
      ],
    });
  }
}
