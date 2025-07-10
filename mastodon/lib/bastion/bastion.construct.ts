import {
  Vpc,
  SecurityGroup,
  InstanceType,
  InstanceClass,
  InstanceSize,
  BlockDeviceVolume,
  SubnetType,
  KeyPair,
  UserData,
  MachineImage,
  Instance,
} from 'aws-cdk-lib/aws-ec2';
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';

export class BastionConstruct extends Construct {
  constructor(
    scope: Construct,
    props: {
      vpc: Vpc;
      contentBucket: Bucket;
      backyardBucket: Bucket;
      dbSecrets: ISecret;
      keyPair: KeyPair;
      cache: {
        endpointAddress: string;
        endpointPort: string;
      };
    },
  ) {
    super(scope, 'bastion');

    // SecurityGroup
    const securityGroup = new SecurityGroup(this, 'mastodon-bastion-security-group', {
      vpc: props.vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });

    // IAM Role
    const role = new Role(this, 'mastodon-bastion-role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      inlinePolicies: {
        codeBuildServicePolicies: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:*'],
              resources: [`${props.contentBucket.bucketArn}`],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:*'],
              resources: [`${props.contentBucket.bucketArn}/*`],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:*'],
              resources: [`${props.backyardBucket.bucketArn}`],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:*'],
              resources: [`${props.backyardBucket.bucketArn}/*`],
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

    const fqdn = [process.env.MASTODON_HOST, process.env.ZONE_DOMAIN].filter((v) => !!v).join('.');
    const attachmentDistFqdn = [process.env.MASTODON_ATTACHMENT_HOST, process.env.ZONE_DOMAIN]
      .filter((v) => !!v)
      .join('.');
    const userData = UserData.forLinux();
    userData.addCommands(
      `apt-get update`,
      `apt-get upgrade -y`,
      `DEBIAN_FRONTEND=noninteractive apt-get install -y git build-essential curl wget gnupg apt-transport-https lsb-release ca-certificates postgresql-client unzip jq imagemagick libvips-tools ffmpeg libpq-dev libxml2-dev libxslt1-dev file git-core g++ libprotobuf-dev protobuf-compiler pkg-config gcc autoconf bison build-essential libssl-dev libyaml-dev libreadline6-dev zlib1g-dev libncurses5-dev libffi-dev libgdbm-dev libidn11-dev libicu-dev libjemalloc-dev`,
      // Redis client
      `curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg`,
      `echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/redis.list`,
      `apt-get update`,
      `apt-get install -y redis-tools`,
      // Node.js
      `mkdir -p /etc/apt/keyrings`,
      `curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg`,
      `NODE_MAJOR=${process.env.NODE_VERSION}`,
      `echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list`,
      `apt-get update`,
      `apt-get install -y nodejs`,
      // Yarn
      `corepack enable`,
      `corepack prepare`,
      // `yarn set version latest`,
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
      `sudo -u mastodon git checkout ${process.env.MASTODON_GIT_TAG}`,
      `sudo -u mastodon /usr/local/rbenv/shims/bundle config deployment 'true'`,
      `sudo -u mastodon /usr/local/rbenv/shims/bundle config without 'development test'`,
      `sudo -u mastodon /usr/local/rbenv/shims/bundle install -j$(getconf _NPROCESSORS_ONLN)`,
      `sudo -u mastodon yarn install --immutable`,
      // Retreve Secrets
      `cd /home/mastodon/mastodon`,
      `SECRET_ID=${props.dbSecrets.secretArn}`,
      'JSON=$(aws secretsmanager get-secret-value --secret-id ${SECRET_ID} | jq -cM ".SecretString | fromjson")',
      'DB_HOST=$(echo ${JSON} | jq -rM .host)',
      'DB_PORT=$(echo ${JSON} | jq -rM .port)',
      'DB_NAME=$(echo ${JSON} | jq -rM .dbname)',
      'DB_USER_NAME=$(echo ${JSON} | jq -rM .username)',
      'DB_PASSWORD=$(echo ${JSON} | jq -rM .password)',
      process.env.MASTODON_SECRET_KEY_BASE
        ? `SECRET_KEY_BASE=${process.env.MASTODON_SECRET_KEY_BASE}`
        : 'SECRET_KEY_BASE=$(sudo -u mastodon RAILS_ENV=production /usr/local/rbenv/shims/bundle exec rake secret)',
      process.env.MASTODON_OTP_SECRET
        ? `OTP_SECRET=${process.env.MASTODON_OTP_SECRET}`
        : 'OTP_SECRET=$(sudo -u mastodon RAILS_ENV=production /usr/local/rbenv/shims/bundle exec rake secret)',
      // Configure
      `cd /home/mastodon/mastodon`,
      `sudo -u mastodon touch .env.production`,
      process.env.ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY
        ? `echo 'ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY=${process.env.ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY}' >> .env.production`
        : `sudo -u mastodon RAILS_ENV=production bin/rails db:encryption:init > .env.production`,
      process.env.ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT
        ? `echo 'ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT=${process.env.ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT}' >> .env.production`
        : '',
      process.env.ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY
        ? `echo 'ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY=${process.env.ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY}' >> .env.production`
        : '',
      `echo 'LOCAL_DOMAIN=${fqdn}' >> .env.production`,
      'echo "DB_HOST=${DB_HOST}" >> .env.production',
      'echo "DB_PORT=${DB_PORT}" >> .env.production',
      'echo "DB_NAME=${DB_NAME}" >> .env.production',
      'echo "DB_USER=${DB_USER_NAME}" >> .env.production',
      'echo "DB_PASS=${DB_PASSWORD}" >> .env.production',
      `echo 'REDIS_HOST=${props.cache.endpointAddress}' >> .env.production`,
      `echo 'REDIS_PORT=${props.cache.endpointPort}' >> .env.production`,
      `echo 'SMTP_SERVER=${process.env.SMTP_SERVER}' >> .env.production`,
      `echo 'SMTP_PORT=${process.env.SMTP_PORT}' >> .env.production`,
      `echo 'SMTP_LOGIN=${process.env.SMTP_LOGIN}' >> .env.production`,
      `echo 'SMTP_PASSWORD=${process.env.SMTP_PASSWORD}' >> .env.production`,
      `echo 'SMTP_FROM_ADDRESS=${process.env.SMTP_FROM_ADDRESS}' >> .env.production`,
      `echo 'S3_ENABLED=true' >> .env.production`,
      `echo 'S3_BUCKET=${props.contentBucket.bucketName}' >> .env.production`,
      `echo 'S3_REGION=${process.env.AWS_REGION}' >> .env.production`,
      `echo 'S3_HOSTNAME=s3.dualstack.${process.env.AWS_REGION}.amazonaws.com' >> .env.production`,
      `echo 'S3_ALIAS_HOST=${attachmentDistFqdn}' >> .env.production `,
      'echo "SECRET_KEY_BASE=${SECRET_KEY_BASE}" >> .env.production',
      `echo "OTP_SECRET=$OTP_SECRET"  >> .env.production`,
      `echo "MASTODON_USE_LIBVIPS=true"  >> .env.production`,
      `sudo -u mastodon RAILS_ENV=production /usr/local/rbenv/shims/bundle exec rake mastodon:webpush:generate_vapid_key >> .env.production`,
      `aws s3 cp .env.production s3://${props.backyardBucket.bucketName}/config/.env.production`,
    );

    const machineImage = MachineImage.genericLinux(
      {
        'us-east-1': process.env.BASTION_AMI!,
      },
      {
        userData,
      },
    );

    // Bastion
    new Instance(this, 'mastodon-bastion-instance', {
      instanceType: InstanceType.of(InstanceClass.T3A, InstanceSize.MEDIUM),
      keyPair: props.keyPair,
      vpc: props.vpc,
      machineImage,
      securityGroup,
      vpcSubnets: props.vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }),
      role,
      blockDevices: [
        {
          deviceName: '/dev/sda1',
          volume: BlockDeviceVolume.ebs(20),
        },
      ],
      ssmSessionPermissions: true,
    });
  }
}
