import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Route53Construct } from './route53.construct';

export class MastodonRoute53Stack extends cdk.Stack {
  public readonly route53: Route53Construct;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.route53 = new Route53Construct(this);
  }
}
