import * as cdk from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { CfnCacheCluster } from 'aws-cdk-lib/aws-elasticache';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { ApplicationLoadBalancerStack } from './alb-stack';
import { AppStack } from './app-stack';

export interface AppStackProps extends cdk.StackProps {
  vpc: Vpc;
  contents: Bucket;
  backyard: Bucket;
  accessLog: Bucket;
  dbSecrets: Secret;
  cacheCluster: CfnCacheCluster;
}

export class MastodonAppStack extends cdk.Stack {
  public readonly app: AppStack;
  public readonly applicationLoadBalancer: ApplicationLoadBalancerStack;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    this.app = new AppStack(this, props.vpc, props.contents, props.backyard, props.dbSecrets, props.cacheCluster);
    this.applicationLoadBalancer = new ApplicationLoadBalancerStack(
      this,
      props.vpc,
      this.app.autoScalingGroup,
      props.accessLog,
    );
  }
}
