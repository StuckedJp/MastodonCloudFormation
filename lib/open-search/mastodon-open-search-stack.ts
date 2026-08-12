import * as cdk from 'aws-cdk-lib';
import { KeyPair, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { ParamsType } from '../param-type';
import { OpenSearchConstruct } from './open-search.construct';
import { OpenSearchLiteConstruct } from './open-search-lite.construct';

export interface OpenSearchStackProps extends cdk.StackProps {
  vpc: Vpc;
  keyPair: KeyPair;
  backyardBucket: Bucket;
}

export class MastodonOpenSearchStack extends cdk.Stack {
  public readonly openSearch: OpenSearchConstruct;
  public readonly openSearchLite: OpenSearchLiteConstruct;

  constructor(scope: Construct, id: string, props: OpenSearchStackProps, params: ParamsType) {
    super(scope, id, props);

    if (!params.elasticSearch) {
      return;
    }

    if (params.elasticSearch.diy) {
      this.openSearchLite = new OpenSearchLiteConstruct(this, props, params);
    } else {
      this.openSearch = new OpenSearchConstruct(this, props, params);
    }
  }
}
