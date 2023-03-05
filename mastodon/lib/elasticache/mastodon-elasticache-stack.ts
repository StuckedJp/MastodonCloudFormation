import * as cdk from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { ElasticacheStack } from './elasticache-stack';

export interface ElasticacheStackProps extends cdk.StackProps {
  vpc: Vpc;
}

export class MastodonElasticacheStack extends cdk.Stack {
  public readonly elasticache: ElasticacheStack;

  constructor(scope: Construct, id: string, props: ElasticacheStackProps) {
    super(scope, id, props);

    this.elasticache = new ElasticacheStack(this, props.vpc);
  }
}
