import { Vpc, SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationProtocolVersion,
  IpAddressType,
  ListenerCertificate,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';
import { Duration } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

export class ApplicationLoadBalancerConstruct extends Construct {
  public readonly applicationLoadBalancer: ApplicationLoadBalancer;

  constructor(scope: Construct, vpc: Vpc, asg: AutoScalingGroup, certArnParamName: string) {
    super(scope, 'application-load-balancer');

    // SecurityGroup(ALB)
    const securityGroup = new SecurityGroup(this, 'mastodon-alb-security-group', {
      vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });

    // certificate
    const certificate = Certificate.fromCertificateArn(
      this,
      'mastodon-alb-cert-acm',
      StringParameter.valueFromLookup(this, certArnParamName),
    );

    // ALB
    this.applicationLoadBalancer = new ApplicationLoadBalancer(this, 'mastodon-alb', {
      vpc,
      securityGroup,
      vpcSubnets: vpc.selectSubnets({ subnetType: SubnetType.PUBLIC }),
      internetFacing: true,
      ipAddressType: IpAddressType.DUAL_STACK,
      http2Enabled: true,
    });

    // Listeners
    const listener = this.applicationLoadBalancer.addListener('mastodon-alb-listener-https', {
      protocol: ApplicationProtocol.HTTPS,
      port: 443,
      open: true,
      certificates: [certificate],
    });

    // Targets
    listener.addTargets('mastodon-alb-listener-target', {
      port: 80,
      targets: [asg],
      protocol: ApplicationProtocol.HTTP,
      protocolVersion: ApplicationProtocolVersion.HTTP1,
      healthCheck: {
        enabled: true,
        path: '/health',
        interval: Duration.minutes(1),
        healthyHttpCodes: '200-399',
        port: '80',
        timeout: Duration.seconds(15),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
      },
    });
  }
}
