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

export class ApplicationLoadBalancerConstruct extends Construct {
  constructor(scope: Construct, vpc: Vpc, asg: AutoScalingGroup, backyardBucket: Bucket) {
    super(scope, 'application-load-balancer');

    // SecurityGroup(ALB)
    const securityGroup = new SecurityGroup(this, 'mastodon-alb-security-group', {
      vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });

    // ALB
    const alb = new ApplicationLoadBalancer(this, 'mastodon-alb', {
      vpc,
      securityGroup,
      vpcSubnets: vpc.selectSubnets({ subnetType: SubnetType.PUBLIC }),
      internetFacing: true,
      ipAddressType: IpAddressType.DUAL_STACK,
      http2Enabled: true,
    });
    alb.logAccessLogs(backyardBucket, process.env.LB_ACCESS_LOG_PREFIX);

    // Listeners
    const listener = alb.addListener('mastodon-alb-listener-https', {
      port: 443,
      open: true,
      certificates: [ListenerCertificate.fromArn(process.env.LB_CERTIFICATE_ARN!)],
      protocol: ApplicationProtocol.HTTPS,
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
