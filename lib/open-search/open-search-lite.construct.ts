import { Construct } from 'constructs';
import {
  Vpc,
  SecurityGroup,
  Peer,
  Port,
  SubnetType,
  UserData,
  MachineImage,
  Instance,
  InstanceType,
  KeyPair,
  BlockDeviceVolume,
} from 'aws-cdk-lib/aws-ec2';
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ParamsType } from '../param-type';

export class OpenSearchLiteConstruct extends Construct {
  public readonly instance: Instance;

  constructor(
    scope: Construct,
    props: {
      vpc: Vpc;
      keyPair: KeyPair;
      backyardBucket: Bucket;
    },
    params: ParamsType,
  ) {
    super(scope, 'opensearch');

    if (!params.elasticSearch) {
      return;
    }

    const role = new Role(this, 'mastodon-opensearch-role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      inlinePolicies: {
        codeBuildServicePolicies: new PolicyDocument({
          statements: [
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

    // SecurityGroup
    const securityGroup = new SecurityGroup(this, 'mastodon-opensearch-security-group', {
      vpc: props.vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });
    props.vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }).subnets.forEach((subnet) => {
      securityGroup.addIngressRule(Peer.ipv4(subnet.ipv4CidrBlock), Port.tcp(9200));
    });

    // OpenSearch用の Ec2 インスタンス
    const userData = UserData.forLinux();
    userData.addCommands(
      `apt-get update`,
      `apt-get upgrade -y`,
      `DEBIAN_FRONTEND=noninteractive apt-get install -y git build-essential curl wget gnupg apt-transport-https lsb-release ca-certificates unzip jq`,

      // Latest Docker
      // Add Docker's official GPG key:
      `install -m 0755 -d /etc/apt/keyrings`,
      `curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc`,
      `chmod a+r /etc/apt/keyrings/docker.asc`,
      // Add the repository to Apt sources:
      `rm -f /etc/apt/sources.list.d/docker.sources`,
      `echo "Types: deb" >> /etc/apt/sources.list.d/docker.sources`,
      `echo "URIs: https://download.docker.com/linux/ubuntu" >> /etc/apt/sources.list.d/docker.sources`,
      'echo "Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")" >> /etc/apt/sources.list.d/docker.sources',
      `echo "Components: stable" >> /etc/apt/sources.list.d/docker.sources`,
      `echo "Architectures: $(dpkg --print-architecture)" >> /etc/apt/sources.list.d/docker.sources`,
      `echo "Signed-By: /etc/apt/keyrings/docker.asc" >> /etc/apt/sources.list.d/docker.sources`,
      `apt-get update`,
      `DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`,
      `systemctl start docker`,
      `usermod -aG docker ubuntu`,

      // AWS CLI
      `cd /root`,
      `curl "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o "awscliv2.zip"`,
      `unzip awscliv2.zip`,
      `./aws/install`,
    );

    const amiMap = new Map();
    amiMap.set(params.aws.region, params.elasticSearch.ami);
    const machineImage = MachineImage.genericLinux(Object.fromEntries(amiMap), {
      userData,
    });

    // Bastion
    this.instance = new Instance(this, 'mastodon-opensearch-instance', {
      instanceType: new InstanceType(params.elasticSearch.instanceType),
      keyPair: props.keyPair,
      vpc: props.vpc,
      machineImage,
      securityGroup,
      vpcSubnets: props.vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }),
      role,
      blockDevices: [
        {
          deviceName: '/dev/sda1',
          volume: BlockDeviceVolume.ebs(params.elasticSearch.storageGB),
        },
      ],
      ssmSessionPermissions: true,
    });
  }
}
