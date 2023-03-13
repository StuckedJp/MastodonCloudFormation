// https://github.com/aws/aws-cdk/issues/894#issuecomment-588566769
import { Construct, IConstruct } from 'constructs';
import { Fn } from 'aws-cdk-lib';
import { CfnInternetGateway, CfnSubnet, CfnVPCCidrBlock, RouterType, Subnet, Vpc } from 'aws-cdk-lib/aws-ec2';

/**
 * Gets a value or throws an exception.
 *
 * @param value A value, possibly undefined
 * @param err The error to throw if `value` is undefined.
 */
const valueOrDie = <T, C extends T = T>(value: T | undefined, err: Error): C => {
  if (value === undefined) throw err;
  return value as C;
};

export interface Ipv6SubnetProps {
  vpc: Vpc;
}

/**
 * Adds IPv6 support to a VPC by modifying the CfnSubnets.
 *
 * For example:
 * ```
 * const vpc = new Vpc(this, "MyVpc", { ... });
 * new Ipv6Workaround(this, "Ipv6Workaround", {
 *   vpc: vpc,
 * });
 * ```
 */
export class Ipv6Subnet extends Construct {
  constructor(scope: Construct, id: string, props: Ipv6SubnetProps) {
    super(scope, id);

    const { vpc } = props;

    // Associate an IPv6 block with the VPC.
    // Note: You're may get an error like, "The network 'your vpc id' has met
    // its maximum number of allowed CIDRs" if you cause this
    // `AWS::EC2::VPCCidrBlock` ever to be recreated.
    const ipv6Cidr = new CfnVPCCidrBlock(this, 'Ipv6Cidr', {
      vpcId: vpc.vpcId,
      amazonProvidedIpv6CidrBlock: true,
    });

    // Get the vpc's internet gateway so we can create default routes for the
    // public subnets.
    const internetGateway = valueOrDie<IConstruct, CfnInternetGateway>(
      vpc.node.children.find((c) => c instanceof CfnInternetGateway),
      new Error("Couldn't find an internet gateway"),
    );

    // Modify each public subnet so that it has both a public route and an ipv6
    // CIDR.
    vpc.publicSubnets.forEach((subnet, idx) => {
      // Add a default ipv6 route to the subnet's route table.
      const unboxedSubnet = subnet as Subnet;
      unboxedSubnet.addRoute('IPv6Default', {
        routerId: internetGateway.ref,
        routerType: RouterType.GATEWAY,
        destinationIpv6CidrBlock: '::/0',
      });

      // Find a CfnSubnet (raw cloudformation resources) child to the public
      // subnet nodes.
      const cfnSubnet = valueOrDie<IConstruct, CfnSubnet>(
        subnet.node.children.find((c) => c instanceof CfnSubnet),
        new Error("Couldn't find a CfnSubnet"),
      );

      // Use the intrinsic Fn::Cidr CloudFormation function on the VPC's
      // first IPv6 block to determine ipv6 /64 cidrs for each subnet as
      // a function of the public subnet's index.
      const vpcCidrBlock = Fn.select(0, vpc.vpcIpv6CidrBlocks);
      const ipv6Cidrs = Fn.cidr(vpcCidrBlock, vpc.publicSubnets.length, '64');
      cfnSubnet.ipv6CidrBlock = Fn.select(idx, ipv6Cidrs);

      // The subnet depends on the ipv6 cidr being allocated.
      cfnSubnet.addDependency(ipv6Cidr);
    });
  }
}
