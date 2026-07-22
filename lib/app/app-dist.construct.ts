import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  CachedMethods,
  CachePolicy,
  Distribution,
  OriginRequestPolicy,
  OriginSslPolicy,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { LoadBalancerV2Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { AaaaRecord, ARecord, ARecordProps, PublicHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { SsmParameterReaderCustomResource } from '../custom-resources/ssm-parameter-reader.construct';
import { ParamsType } from '../param-type';

export class ApplicationDistributionConstruct extends Construct {
  public readonly distribution: Distribution;

  constructor(
    scope: Construct,
    applicationLoadBalancer: ApplicationLoadBalancer,
    logBucket: Bucket,
    certArnParamName: string,
    params: ParamsType,
  ) {
    super(scope, 'application-distribution');

    const fqdn = [params.domain.hostName, params.domain.name].filter((v) => !!v).join('.');

    // certificate
    const certArnReader = new SsmParameterReaderCustomResource(this, 'application-distribution-cert-arn-reader', {
      parameterName: certArnParamName,
      region: 'us-east-1',
    });
    const certificate = Certificate.fromCertificateArn(this, 'application-distribution-acm', certArnReader.stringValue);

    // Distribution
    this.distribution = new Distribution(this, 'application-distribution-cloud-front', {
      defaultBehavior: {
        origin: new LoadBalancerV2Origin(applicationLoadBalancer, {
          originSslProtocols: [OriginSslPolicy.TLS_V1_2],
        }),
        allowedMethods: AllowedMethods.ALLOW_ALL,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        cachedMethods: CachedMethods.CACHE_GET_HEAD,
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        responseHeadersPolicy: ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
      },
      domainNames: [fqdn],
      certificate,
      logBucket,
      logFilePrefix: params.app.accessLogPrefix,
      logIncludesCookies: false,
    });

    // DNS Records
    const zone = PublicHostedZone.fromLookup(this, 'attachment-distribution-hosted-zone', {
      domainName: params.domain.name,
    });
    const aRecordProp: ARecordProps = {
      recordName: params.domain.hostName,
      zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
    };
    new ARecord(this, 'attachment-distribution-a-record', aRecordProp);
    new AaaaRecord(this, 'attachment-distribution-aaaa-record', aRecordProp);
  }
}
