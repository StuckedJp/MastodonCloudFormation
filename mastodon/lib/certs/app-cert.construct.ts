import * as cdk from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { PublicHostedZone } from 'aws-cdk-lib/aws-route53';
import { ParameterDataType, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ParamsType } from '../param-type';

export class ApplicationCertConstruct extends Construct {
  readonly appCert: Certificate;
  readonly appCertArnParameterName: string;

  constructor(scope: Construct, props: cdk.StackProps, params: ParamsType) {
    super(scope, 'application-cert');

    const zone = PublicHostedZone.fromLookup(this, 'application-cert-hosted-zone', {
      domainName: params.domain.name,
    });

    const appDistFqdn = [params.domain.hostName, params.domain.name].filter((v) => !!v).join('.');
    this.appCert = new Certificate(this, 'application-cert-certificate', {
      certificateName: `application-certificate-${params.envName}`,
      domainName: appDistFqdn,
      validation: CertificateValidation.fromDns(zone),
    });

    // SSM に保存
    this.appCertArnParameterName = `/mastodon/${params.aws.region}/${params.envName}/certificate_arn/app`;
    new StringParameter(this, 'application-cert-param', {
      dataType: ParameterDataType.TEXT,
      parameterName: this.appCertArnParameterName,
      stringValue: this.appCert.certificateArn,
    });
  }
}
