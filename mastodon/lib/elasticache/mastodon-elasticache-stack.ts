import * as cdk from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { ElasticacheConstruct } from './elasticache.construct';

export interface ElasticacheStackProps extends cdk.StackProps {
  vpc: Vpc;
}

export class MastodonElasticacheStack extends cdk.Stack {
  public readonly elasticache: ElasticacheConstruct;

  constructor(scope: Construct, id: string, props: ElasticacheStackProps) {
    super(scope, id, props);

    this.elasticache = new ElasticacheConstruct(this, props.vpc);
  }
}
