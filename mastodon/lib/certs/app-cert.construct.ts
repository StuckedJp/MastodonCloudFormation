import * as cdk from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { PublicHostedZone } from 'aws-cdk-lib/aws-route53';
import { ParameterDataType, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class ApplicationCertConstruct extends Construct {
  readonly appCert: Certificate;
  readonly appCertArnParameterName: string;

  constructor(scope: Construct, props?: cdk.StackProps) {
    super(scope, 'application-cert');

    const zone = PublicHostedZone.fromLookup(this, 'application-cert-hosted-zone', {
      domainName: process.env.ZONE_DOMAIN!,
    });

    const appDistFqdn = [process.env.MASTODON_HOST, process.env.ZONE_DOMAIN].filter((v) => !!v).join('.');
    this.appCert = new Certificate(this, 'application-cert-certificate', {
      domainName: appDistFqdn,
      validation: CertificateValidation.fromDns(zone),
    });

    // SSM に保存
    this.appCertArnParameterName = `/mastodon/certificate_arn/app`;
    new StringParameter(this, 'application-cert-param', {
      dataType: ParameterDataType.TEXT,
      parameterName: this.appCertArnParameterName,
      stringValue: this.appCert.certificateArn,
    });
  }
}
