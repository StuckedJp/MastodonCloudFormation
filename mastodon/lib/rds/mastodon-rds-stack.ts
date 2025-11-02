import * as cdk from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { RdsConstruct } from './rds.construct';
import { ParamsType } from '../param-type';

export interface RdsStackProps extends cdk.StackProps {
  vpcIdParameterName: string;
}

export class MastodonRdsStack extends cdk.Stack {
  public readonly rds: RdsConstruct;

  constructor(scope: Construct, id: string, props: RdsStackProps, params: ParamsType) {
    super(scope, id, props);

    this.rds = new RdsConstruct(this, props.vpcIdParameterName, params);
  }
}
