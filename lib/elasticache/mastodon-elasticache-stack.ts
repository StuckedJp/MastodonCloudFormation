import * as cdk from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { ValkeyConstruct } from './valkey.construct';
import { ParamsType } from '../param-type';

export interface ElasticacheStackProps extends cdk.StackProps {
  vpc: Vpc;
}

export class MastodonElasticacheStack extends cdk.Stack {
  public readonly valkey: ValkeyConstruct;

  constructor(scope: Construct, id: string, props: ElasticacheStackProps, params: ParamsType) {
    super(scope, id, props);

    this.valkey = new ValkeyConstruct(this, props.vpc, params);
  }
}
