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
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine,
  DatabaseInstanceFromSnapshot,
  PostgresEngineVersion,
} from 'aws-cdk-lib/aws-rds';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class RdsStack extends Construct {
  public readonly databaseInstance: DatabaseInstance;
  public readonly secret: Secret;

  constructor(scope: Construct, vpc: Vpc) {
    super(scope, 'rds');

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

    // username, password
    this.secret = new Secret(this, 'mastodon-rds-secret', {
      secretName: 'mastodon-rds-secret',
      generateSecretString: {
        excludePunctuation: true,
        includeSpace: false,
        secretStringTemplate: JSON.stringify({ username: process.env.RDS_USER_NAME }),
        generateStringKey: 'password',
      },
    });

    // Using the templated secret as credentials
    if (process.env.RDS_SNAPSHOT_ID) {
      this.databaseInstance = new DatabaseInstanceFromSnapshot(this, 'mastodon-rds-instance', {
        snapshotIdentifier: process.env.RDS_SNAPSHOT_ID,
        engine: DatabaseInstanceEngine.postgres({
          version: PostgresEngineVersion.VER_15,
        }),
        instanceType: InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.MICRO),
        allowMajorVersionUpgrade: true,
        autoMinorVersionUpgrade: true,
        allocatedStorage: Number(process.env.RDS_STORAGE_GB),
        vpc,
        publiclyAccessible: false,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [securityGroup],
      });
    } else {
      this.databaseInstance = new DatabaseInstance(this, 'mastodon-rds-instance', {
        engine: DatabaseInstanceEngine.postgres({
          version: PostgresEngineVersion.VER_14_6,
        }),
        instanceType: InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.MICRO),
        credentials: Credentials.fromSecret(this.secret),
        databaseName: process.env.RDS_DATABASE_NAME,
        allowMajorVersionUpgrade: true,
        autoMinorVersionUpgrade: true,
        allocatedStorage: Number(process.env.RDS_STORAGE_GB),
        vpc,
        publiclyAccessible: false,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [securityGroup],
      });
    }
  }
}
