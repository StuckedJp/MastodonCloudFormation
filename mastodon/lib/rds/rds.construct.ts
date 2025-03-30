import {
  SubnetType,
  Vpc,
  InstanceType,
  InstanceClass,
  InstanceSize,
  SecurityGroup,
  Peer,
  Port,
} from 'aws-cdk-lib/aws-ec2';
import {
  CaCertificate,
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine,
  DatabaseInstanceFromSnapshot,
  PostgresEngineVersion,
  SnapshotCredentials,
} from 'aws-cdk-lib/aws-rds';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

export class RdsConstruct extends Construct {
  public readonly databaseInstance: DatabaseInstance;
  public readonly secret: ISecret;

  constructor(scope: Construct, vpcIdParameterName: string) {
    super(scope, 'rds');

    const vpc = Vpc.fromLookup(this, 'mastodon-rds-vpc', {
      vpcId: StringParameter.valueFromLookup(this, vpcIdParameterName),
    });

    // SecurityGroup
    const securityGroup = new SecurityGroup(this, 'mastodon-rds-security-group', {
      vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });
    securityGroup.addIngressRule(Peer.ipv4(vpc.privateSubnets[0].ipv4CidrBlock), Port.tcp(5432));
    securityGroup.addIngressRule(Peer.ipv4(vpc.privateSubnets[1].ipv4CidrBlock), Port.tcp(5432));
    securityGroup.addIngressRule(Peer.ipv4(vpc.publicSubnets[0].ipv4CidrBlock), Port.tcp(5432));
    securityGroup.addIngressRule(Peer.ipv4(vpc.publicSubnets[1].ipv4CidrBlock), Port.tcp(5432));

    // パスワードに使わない文字
    const excludeCharacters = ';&|^<>?*$`\'"\\!/@';

    if (process.env.RDS_SNAPSHOT_ID) {
      const credentials = SnapshotCredentials.fromGeneratedSecret(process.env.RDS_USER_NAME!, {
        excludeCharacters,
      });
      this.databaseInstance = new DatabaseInstanceFromSnapshot(this, 'mastodon-rds-instance', {
        snapshotIdentifier: process.env.RDS_SNAPSHOT_ID,
        engine: DatabaseInstanceEngine.postgres({
          version: PostgresEngineVersion.VER_17_2,
        }),
        credentials,
        instanceType: InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.MICRO),
        allowMajorVersionUpgrade: true,
        autoMinorVersionUpgrade: true,
        allocatedStorage: Number(process.env.RDS_STORAGE_GB),
        caCertificate: CaCertificate.RDS_CA_RSA4096_G1,
        vpc,
        publiclyAccessible: false,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [securityGroup],
      });
    } else {
      const credentials = Credentials.fromGeneratedSecret(process.env.RDS_USER_NAME!, {
        excludeCharacters,
      });
      this.databaseInstance = new DatabaseInstance(this, 'mastodon-rds-instance', {
        engine: DatabaseInstanceEngine.postgres({
          version: PostgresEngineVersion.VER_17,
        }),
        instanceType: InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.MICRO),
        credentials,
        databaseName: process.env.RDS_DATABASE_NAME,
        allowMajorVersionUpgrade: true,
        autoMinorVersionUpgrade: true,
        allocatedStorage: Number(process.env.RDS_STORAGE_GB),
        caCertificate: CaCertificate.RDS_CA_RSA4096_G1,
        vpc,
        publiclyAccessible: false,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [securityGroup],
      });
    }

    this.secret = this.databaseInstance.secret!;
  }
}
