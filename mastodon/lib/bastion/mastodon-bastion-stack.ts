import * as cdk from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { CfnCacheCluster } from 'aws-cdk-lib/aws-elasticache';
import { DatabaseInstance } from 'aws-cdk-lib/aws-rds';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { BastionStack } from './bastion-stack';

export interface BastionStackProps extends cdk.StackProps {
  vpc: Vpc;
  contents: Bucket;
  backyard: Bucket;
  dbSecrets: Secret;
  dbInstance: DatabaseInstance;
  cacheCluster: CfnCacheCluster;
}

export class MastodonBastionStack extends cdk.Stack {
  public readonly bastion: BastionStack;

  constructor(scope: Construct, id: string, props: BastionStackProps) {
    super(scope, id, props);

    this.bastion = new BastionStack(
      this,
      props.vpc,
      props.contents,
      props.backyard,
      props.dbSecrets,
      props.dbInstance,
      props.cacheCluster,
    );
  }
}
