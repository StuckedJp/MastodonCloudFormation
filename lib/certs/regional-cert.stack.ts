import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApplicationCertConstruct } from './app-cert.construct';
import { ParamsType } from '../param-type';

export class RegionalCertStack extends cdk.Stack {
  readonly appCert: ApplicationCertConstruct;

  constructor(scope: Construct, id: string, props: cdk.StackProps, params: ParamsType) {
    super(scope, id, props);

    if (props.env?.region !== 'us-east-1') {
      this.appCert = new ApplicationCertConstruct(this, props, params);
    }
  }
}
