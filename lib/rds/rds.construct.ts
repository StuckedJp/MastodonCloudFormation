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
  IDatabaseInstance,
  PostgresEngineVersion,
  SnapshotCredentials,
  StorageType,
} from 'aws-cdk-lib/aws-rds';
import { ISecret, Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { ParamsType } from '../param-type';

export class RdsConstruct extends Construct {
  public readonly databaseInstance: IDatabaseInstance;
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
      const databaseInstance = new DatabaseInstanceFromSnapshot(this, 'mastodon-rds-instance', {
        snapshotIdentifier: params.rds.snapshotId,
        engine: DatabaseInstanceEngine.postgres({
          version: PostgresEngineVersion.VER_18,
        }),
        credentials: SnapshotCredentials.fromSecret(secret),
        instanceType: InstanceType.of(InstanceClass.BURSTABLE4_GRAVITON, InstanceSize.MICRO),
        allowMajorVersionUpgrade: true,
        autoMinorVersionUpgrade: true,
        allocatedStorage: params.rds.storageGB,
        storageType: StorageType.GP3,
        caCertificate: CaCertificate.RDS_CA_RSA4096_G1,
        vpc,
        publiclyAccessible: false,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [securityGroup],
      });
      this.secret = databaseInstance.secret!;
      this.databaseInstance = databaseInstance;
    } else {
      const databaseInstance = new DatabaseInstance(this, 'mastodon-rds-instance', {
        engine: DatabaseInstanceEngine.postgres({
          version: PostgresEngineVersion.VER_18,
        }),
        instanceType: InstanceType.of(InstanceClass.BURSTABLE4_GRAVITON, InstanceSize.MICRO),
        credentials: Credentials.fromSecret(secret),
        databaseName: params.rds.databaseName,
        allowMajorVersionUpgrade: true,
        autoMinorVersionUpgrade: true,
        allocatedStorage: params.rds.storageGB,
        storageType: StorageType.GP3,
        caCertificate: CaCertificate.RDS_CA_RSA4096_G1,
        vpc,
        publiclyAccessible: false,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [securityGroup],
      });
      this.secret = databaseInstance.secret!;
      this.databaseInstance = databaseInstance;
    }
  }
}
