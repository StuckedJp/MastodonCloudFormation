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
import { ParamsType } from '../param-type';
import { Domain } from 'aws-cdk-lib/aws-opensearchservice';

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
      elasticSearch?: {
        domain: Domain;
      };
    },
    params: ParamsType,
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

    const fqdn = [params.domain.hostName, params.domain.name].filter((v) => !!v).join('.');
    const attachmentDistFqdn = [params.domain.attachmentHost, params.domain.name].filter((v) => !!v).join('.');
    const userData = UserData.forLinux();
    userData.addCommands(
      `apt-get update`,
      `apt-get upgrade -y`,
      `DEBIAN_FRONTEND=noninteractive apt-get install -y git build-essential curl wget gnupg apt-transport-https lsb-release ca-certificates unzip jq imagemagick libvips-tools ffmpeg libpq-dev libxml2-dev libxslt1-dev file git-core g++ libprotobuf-dev protobuf-compiler pkg-config gcc autoconf bison build-essential libssl-dev libyaml-dev libreadline6-dev zlib1g-dev libncurses5-dev libffi-dev libgdbm-dev libidn11-dev libicu-dev libjemalloc-dev`,
      // Latest Postgresql client
      `sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'`,
      `wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | tee /etc/apt/trusted.gpg.d/pgdg.asc &>/dev/null`,
      `apt-get update`,
      `DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-common postgresql-client`,
      // Redis client
      `curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg`,
      `echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/redis.list`,
      `apt-get update`,
      `apt-get install -y redis-tools`,
      // Node.js
      `mkdir -p /etc/apt/keyrings`,
      `curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg`,
      `NODE_MAJOR=${params.node.version}`,
      `echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list`,
      `apt-get update`,
      `apt-get install -y nodejs`,
      // Yarn
      `corepack enable`,
      `corepack prepare`,
      // `yarn set version latest`,
      // AWS CLI
      `cd /root`,
      // `curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"`,
      `curl "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o "awscliv2.zip"`,
      `unzip awscliv2.zip`,
      `./aws/install`,
      // User add
      `useradd --create-home mastodon`,
      // others に実行権限を付与する
      // https://github.com/mastodon/mastodon/issues/3584
      `chmod +x /home/mastodon`,
      // Mastodon
      `cd /home/mastodon`,
      `sudo -u mastodon git clone ${params.mastodon.git.url} mastodon`,
      `cd mastodon`,
      `sudo -u mastodon git switch ${params.mastodon.git.tag}`,
      `RUBY_VERSION=$(cat .ruby-version)`,
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
      `RUBY_CONFIGURE_OPTS=--with-jemalloc bash -c "rbenv install $RUBY_VERSION"`,
      `rbenv global $RUBY_VERSION`,
      `gem install bundler --no-document`,
      // Mastodon
      `cd /home/mastodon/mastodon`,
      `sudo -u mastodon /usr/local/rbenv/shims/bundle config deployment 'true'`,
      `sudo -u mastodon /usr/local/rbenv/shims/bundle config without 'development test'`,
      `sudo -u mastodon /usr/local/rbenv/shims/bundle install -j$(getconf _NPROCESSORS_ONLN)`,
      `sudo -u mastodon yarn install --immutable`,
      // Configure
      `cd /home/mastodon/mastodon`,
      `rm -f .env.production`,
      `sudo -u mastodon touch .env.production`,
      // ActiveRecord
      params.app.activeRecord.encryption.deterministicKey
        ? `echo 'ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY=${params.app.activeRecord.encryption.deterministicKey}' >> .env.production`
        : `sudo -u mastodon RAILS_ENV=production /usr/local/rbenv/shims/bundle exec rails db:encryption:init | tail -n +2 >> .env.production`,
      params.app.activeRecord.encryption.keyDerivationSalt
        ? `echo 'ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT=${params.app.activeRecord.encryption.keyDerivationSalt}' >> .env.production`
        : '',
      params.app.activeRecord.encryption.primaryKey
        ? `echo 'ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY=${params.app.activeRecord.encryption.primaryKey}' >> .env.production`
        : '',
      params.app.versionMetadata
        ? `echo 'MASTODON_VERSION_METADATA=${params.app.versionMetadata}' >> .env.production`
        : '',
      `echo 'LOCAL_DOMAIN=${fqdn}' >> .env.production`,
      // Database
      `DB_SECRET_ID='${props.dbSecrets.secretArn}'`,
      'JSON=$(aws secretsmanager get-secret-value --secret-id ${DB_SECRET_ID} | jq -cM ".SecretString | fromjson")',
      'DB_HOST=$(echo ${JSON} | jq -rM .host)',
      'DB_PORT=$(echo ${JSON} | jq -rM .port)',
      'DB_NAME=$(echo ${JSON} | jq -rM .dbname)',
      'DB_USER=$(echo ${JSON} | jq -rM .username)',
      'DB_PASS=$(echo ${JSON} | jq -rM .password)',
      'echo "DB_HOST=${DB_HOST}" >> .env.production',
      'echo "DB_PORT=${DB_PORT}" >> .env.production',
      'echo "DB_NAME=${DB_NAME}" >> .env.production',
      'echo "DB_USER=${DB_USER}" >> .env.production',
      'echo "DB_PASS=${DB_PASS}" >> .env.production',
      // Redis/Valkey
      `echo 'REDIS_HOST=${props.cache.endpointAddress}' >> .env.production`,
      `echo 'REDIS_PORT=${props.cache.endpointPort}' >> .env.production`,
      // ElasticSearch
      ...(() => {
        if (params.elasticSearch && props.elasticSearch) {
          return [
            `echo 'ES_ENABLED=true' >> .env.production`,
            `echo 'ES_HOST=https://${props.elasticSearch.domain.domainEndpoint}' >> .env.production`,
            'echo "ES_PORT=443" >> .env.production',
            `echo 'ES_PRESET=single_node_cluster' >> .env.production`,
          ];
        } else {
          return [];
        }
      })(),
      // Mail
      `echo 'SMTP_SERVER=${params.mail.smtp.hostName}' >> .env.production`,
      `echo 'SMTP_PORT=${params.mail.smtp.port}' >> .env.production`,
      `echo 'SMTP_LOGIN=${params.mail.smtp.userName}' >> .env.production`,
      `echo 'SMTP_PASSWORD=${params.mail.smtp.password}' >> .env.production`,
      `echo 'SMTP_FROM_ADDRESS=${params.mail.fromAddress}' >> .env.production`,
      // S3
      `echo 'S3_ENABLED=true' >> .env.production`,
      `echo 'S3_BUCKET=${props.contentBucket.bucketName}' >> .env.production`,
      `echo 'S3_REGION=${params.aws.region}' >> .env.production`,
      `echo 'S3_HOSTNAME=s3.dualstack.${params.aws.region}.amazonaws.com' >> .env.production`,
      `echo 'S3_ALIAS_HOST=${attachmentDistFqdn}' >> .env.production `,
      // Secret
      params.app.secretKeyBase
        ? `SECRET_KEY_BASE=${params.app.secretKeyBase}`
        : 'SECRET_KEY_BASE=$(sudo -u mastodon RAILS_ENV=production /usr/local/rbenv/shims/bundle exec rails secret)',
      params.app.otpSecret
        ? `OTP_SECRET=${params.app.otpSecret}`
        : 'OTP_SECRET=$(sudo -u mastodon RAILS_ENV=production /usr/local/rbenv/shims/bundle exec rails secret)',
      'echo "SECRET_KEY_BASE=${SECRET_KEY_BASE}" >> .env.production',
      `echo "OTP_SECRET=$OTP_SECRET"  >> .env.production`,
      // Misc.
      `echo "MASTODON_USE_LIBVIPS=true"  >> .env.production`,
      `sudo -u mastodon RAILS_ENV=production /usr/local/rbenv/shims/bundle exec rake mastodon:webpush:generate_vapid_key >> .env.production`,
      // Upload To S3
      `aws s3 cp .env.production s3://${props.backyardBucket.bucketName}/config/.env.production`,
    );

    const amiMap = new Map();
    amiMap.set(params.aws.region, params.bastion.ami);
    const machineImage = MachineImage.genericLinux(Object.fromEntries(amiMap), {
      userData,
    });

    // Bastion
    new Instance(this, 'mastodon-bastion-instance', {
      instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MEDIUM),
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
