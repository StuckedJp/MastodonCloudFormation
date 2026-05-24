import * as cdk from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { OpenSearchConstruct } from './open-search.construct';
import { ParamsType } from '../param-type';

export interface OpenSearchStackProps extends cdk.StackProps {
  vpc: Vpc;
}

export class MastodonOpenSearchStack extends cdk.Stack {
  public readonly openSearch: OpenSearchConstruct;

  constructor(scope: Construct, id: string, props: OpenSearchStackProps, params: ParamsType) {
    super(scope, id, props);

    this.openSearch = new OpenSearchConstruct(this, props.vpc, params);
  }
}
