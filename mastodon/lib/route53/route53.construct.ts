import { Construct } from 'constructs';
import { PublicHostedZone } from 'aws-cdk-lib/aws-route53';
import { ParamsType } from '../param-type';

export class Route53Construct extends Construct {
  public readonly hostedZone: PublicHostedZone;

  constructor(scope: Construct, params: ParamsType) {
    super(scope, 'route53');

    // HostZone
    this.hostedZone = new PublicHostedZone(this, 'route53-hosted-zone', {
      zoneName: params.domain.name,
    });
  }
}
