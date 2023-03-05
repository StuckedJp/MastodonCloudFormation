import * as cdk from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { RdsStack } from './rds-stack';

export interface RdsStackProps extends cdk.StackProps {
  vpc: Vpc;
}

export class MastodonRdsStack extends cdk.Stack {
  public readonly rds: RdsStack;

  constructor(scope: Construct, id: string, props: RdsStackProps) {
    super(scope, id, props);

    this.rds = new RdsStack(this, props.vpc);
  }
}
