import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApplicationCertConstruct } from './app-cert.construct';
import { AttachmentCertConstruct } from './attachment-cert.construct';

export class GlobalCertStack extends cdk.Stack {
  readonly appCert: ApplicationCertConstruct;
  readonly attachmentCert: AttachmentCertConstruct;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.appCert = new ApplicationCertConstruct(this, props);
    this.attachmentCert = new AttachmentCertConstruct(this, props);
  }
}
