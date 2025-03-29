import { Construct } from 'constructs';
import { PublicHostedZone } from 'aws-cdk-lib/aws-route53';

export class Route53Construct extends Construct {
  public readonly hostedZone: PublicHostedZone;

  constructor(scope: Construct) {
    super(scope, 'route53');

    // HostZone
    this.hostedZone = new PublicHostedZone(this, 'route53-hosted-zone', {
      zoneName: process.env.ZONE_DOMAIN!,
    });
  }
}
