import { Vpc, SecurityGroup, Peer, Port, SubnetType } from 'aws-cdk-lib/aws-ec2';
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

export class ApplicationLoadBalancerStack extends Construct {
  constructor(scope: Construct, vpc: Vpc, asg: AutoScalingGroup, backyardBucket: Bucket) {
    super(scope, 'application-load-balancer');

    // SecurityGroup(ALB)
    const securityGroup = new SecurityGroup(this, 'mastodon-alb-security-group', {
      vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443));
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80));
    securityGroup.addIngressRule(Peer.anyIpv6(), Port.tcp(443));
    securityGroup.addIngressRule(Peer.anyIpv6(), Port.tcp(80));

    // ALB
    const alb = new ApplicationLoadBalancer(this, 'mastodon-alb', {
      vpc,
      securityGroup,
      internetFacing: true,
      ipAddressType: IpAddressType.DUAL_STACK,
    });
    alb.logAccessLogs(backyardBucket, process.env.LB_ACCESS_LOG_PREFIX);

    // Listeners
    const listenerHttp = alb.addListener('mastodon-alb-listener-http', {
      port: 80,
      open: true,
      protocol: ApplicationProtocol.HTTP,
    });
    const listenerHttps = alb.addListener('mastodon-alb-listener-https', {
      port: 443,
      open: true,
      certificates: [ListenerCertificate.fromArn(process.env.LB_CERTIFICATE_ARN!)],
      protocol: ApplicationProtocol.HTTPS,
    });

    // Targets
    // For Application
    const props = {
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
    };
    listenerHttp.addTargets('mastodon-alb-target-http', props);
    listenerHttps.addTargets('mastodon-alb-target-https', props);
  }
}
