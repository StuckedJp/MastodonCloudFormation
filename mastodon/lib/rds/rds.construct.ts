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
import { ISecret, Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { ParamsType } from '../param-type';

export class RdsConstruct extends Construct {
  public readonly databaseInstance: DatabaseInstance;
  public readonly secret: ISecret;

  constructor(scope: Construct, vpc: Vpc, params: ParamsType) {
    super(scope, 'rds');

    // SecurityGroup
    const securityGroup = new SecurityGroup(this, 'mastodon-rds-security-group', {
      vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });
    vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }).subnets.forEach((subnet) => {
      securityGroup.addIngressRule(Peer.ipv4(subnet.ipv4CidrBlock), Port.tcp(5432));
    });

    // パスワード生成
    const secret = new Secret(this, 'mastodon-rds-secret', {
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 40,
        includeSpace: false,
        secretStringTemplate: JSON.stringify({
          username: params.rds.userName,
          dbname: params.rds.databaseName,
        }),
        generateStringKey: 'password',
      },
    });

    if (params.rds.snapshotId) {
      this.databaseInstance = new DatabaseInstanceFromSnapshot(this, 'mastodon-rds-instance', {
        snapshotIdentifier: params.rds.snapshotId,
        engine: DatabaseInstanceEngine.postgres({
          version: PostgresEngineVersion.VER_17_6,
        }),
        credentials: SnapshotCredentials.fromSecret(secret),
        instanceType: InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.MICRO),
        allowMajorVersionUpgrade: true,
        autoMinorVersionUpgrade: true,
        allocatedStorage: params.rds.storageGB,
        caCertificate: CaCertificate.RDS_CA_RSA4096_G1,
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
          version: PostgresEngineVersion.VER_17,
        }),
        instanceType: InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.MICRO),
        credentials: Credentials.fromSecret(secret),
        databaseName: params.rds.databaseName,
        allowMajorVersionUpgrade: true,
        autoMinorVersionUpgrade: true,
        allocatedStorage: params.rds.storageGB,
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
