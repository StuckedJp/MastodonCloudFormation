import * as path from 'path';
import { Effect, ManagedPolicy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  KeyPair,
  LaunchTemplate,
  MachineImage,
  SecurityGroup,
  SubnetType,
  UserData,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import {
  AdditionalHealthCheckType,
  AutoScalingGroup,
  BlockDeviceVolume,
  HealthChecks,
} from 'aws-cdk-lib/aws-autoscaling';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { ParamsType } from '../param-type';
import { Duration } from 'aws-cdk-lib';

export class AppConstruct extends Construct {
  public readonly autoScalingGroup: AutoScalingGroup;

  constructor(
    scope: Construct,
    vpc: Vpc,
    contentBucket: Bucket,
    backyardBucket: Bucket,
    keyPair: KeyPair,
    params: ParamsType,
  ) {
    super(scope, 'app');

    // SecurityGroup(EC2 Instance)
    const securityGroup = new SecurityGroup(this, 'mastodon-app-instance-security-group', {
      vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });

    // IAM Role
    const role = new Role(this, 'mastodon-app-role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromManagedPolicyArn(
          this,
          'mastodon-app-ssm-managed-policy',
          'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
        ),
      ],
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
              actions: ['acm:*'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    const nginxConf = new Asset(this, 'mastodon-app-asset-nginx', {
      path: path.join(__dirname, 'assets', 'nginx.conf'),
    });
    const systemdSideKiq = new Asset(this, 'mastodon-app-asset-systemd-sidekiq', {
      path: path.join(__dirname, 'assets', 'mastodon-sidekiq.service'),
    });
    const systemdStreaming = new Asset(this, 'mastodon-app-asset-systemd-streaming', {
      path: path.join(__dirname, 'assets', 'mastodon-streaming.service'),
    });
    const systemdStreamingAt = new Asset(this, 'mastodon-app-asset-systemd-streaming-at', {
      path: path.join(__dirname, 'assets', 'mastodon-streaming@.service'),
    });
    const systemdWeb = new Asset(this, 'mastodon-app-asset-systemd-web', {
      path: path.join(__dirname, 'assets', 'mastodon-web.service'),
    });

    const fqdn = [params.domain.hostName, params.domain.name].filter((v) => !!v).join('.');
    const userData = UserData.forLinux();
    userData.addCommands(
      `apt-get update`,
      `apt-get upgrade -y`,
      `DEBIAN_FRONTEND=noninteractive apt-get install -y git build-essential curl wget gnupg apt-transport-https lsb-release ca-certificates postgresql-client unzip jq imagemagick ffmpeg libvips-tools libpq-dev libxml2-dev libxslt1-dev file git-core g++ libprotobuf-dev protobuf-compiler pkg-config gcc autoconf bison build-essential libssl-dev libyaml-dev libreadline6-dev zlib1g-dev libncurses5-dev libffi-dev libgdbm-dev libidn11-dev libicu-dev libjemalloc-dev`,
      `DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx`,
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
      // Configure Mastodon
      `cd /home/mastodon/mastodon`,
      `sudo -u mastodon aws s3 cp s3://${backyardBucket.bucketName}/config/.env.production .env.production`,
      `sudo -u mastodon RAILS_ENV=production /usr/local/rbenv/shims/bundle exec rails assets:precompile`,
      // Configure Nginx
      `aws s3 cp s3://${nginxConf.s3BucketName}/${nginxConf.s3ObjectKey} /tmp/nginx.conf`,
      `cat /tmp/nginx.conf | sed -e 's/example\\.com/${fqdn}/g' > /etc/nginx/sites-available/mastodon`,
      `ln -s /etc/nginx/sites-available/mastodon /etc/nginx/sites-enabled/mastodon`,
      `rm /etc/nginx/sites-enabled/default`,
      `systemctl reload nginx`,
      // Configure Daemon
      `aws s3 cp s3://${systemdSideKiq.s3BucketName}/${systemdSideKiq.s3ObjectKey} /etc/systemd/system/mastodon-sidekiq.service`,
      `aws s3 cp s3://${systemdStreaming.s3BucketName}/${systemdStreaming.s3ObjectKey} /etc/systemd/system/mastodon-streaming.service`,
      `aws s3 cp s3://${systemdStreamingAt.s3BucketName}/${systemdStreamingAt.s3ObjectKey} /etc/systemd/system/mastodon-streaming@.service`,
      `aws s3 cp s3://${systemdWeb.s3BucketName}/${systemdWeb.s3ObjectKey} /etc/systemd/system/mastodon-web.service`,
      // Daemon start
      `systemctl daemon-reload`,
      `systemctl enable --now mastodon-web mastodon-sidekiq mastodon-streaming mastodon-streaming@4000`,
      `reboot`,
    );

    // https://cloud-images.ubuntu.com/locator/ec2/
    const amiMap = new Map();
    amiMap.set(params.aws.region, params.bastion.ami);
    const machineImage = MachineImage.genericLinux(Object.fromEntries(amiMap));
    const launchTemplate = new LaunchTemplate(this, 'mastodon-app-launch-template', {
      instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MEDIUM),
      keyPair,
      machineImage,
      userData,
      securityGroup,
      role,
      blockDevices: [
        {
          deviceName: '/dev/sda1',
          volume: BlockDeviceVolume.ebs(params.app.storageGB),
        },
      ],
    });

    // Application Server
    this.autoScalingGroup = new AutoScalingGroup(this, 'mastodon-app-asg', {
      vpc,
      launchTemplate,
      vpcSubnets: vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }),
      minCapacity: 1,
      maxCapacity: 1,
      healthChecks: HealthChecks.withAdditionalChecks({
        additionalTypes: [AdditionalHealthCheckType.ELB],
        gracePeriod: Duration.minutes(60),
      }),
    });

    nginxConf.grantRead(this.autoScalingGroup);
    systemdSideKiq.grantRead(this.autoScalingGroup);
    systemdStreaming.grantRead(this.autoScalingGroup);
    systemdStreamingAt.grantRead(this.autoScalingGroup);
    systemdWeb.grantRead(this.autoScalingGroup);
  }
}
