/*
 * Copyright (C) 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Timestamp} from 'common/time';
import {AddOperation} from 'trace/tree_node/operations/add_operation';
import {PropertyTreeNode} from 'trace/tree_node/property_tree_node';
import {DEFAULT_PROPERTY_TREE_NODE_FACTORY} from 'trace/tree_node/property_tree_node_factory';

export type MakeTimestampStrategyType = (valueNs: bigint) => Timestamp;

export class TransformToTimestamp extends AddOperation<PropertyTreeNode> {
  constructor(
    private readonly timestampNames: string[],
    private readonly makeTimestampStrategy: MakeTimestampStrategyType
  ) {
    super();
  }

  override makeProperties(value: PropertyTreeNode): PropertyTreeNode[] {
    const timestampNodes: PropertyTreeNode[] = [];

    for (const property of value.getAllChildren()) {
      if (this.timestampNames.includes(property.name)) {
        const nanosLong = property.getValue();
        if (nanosLong === undefined || nanosLong === null) {
          return [];
        }
        const timestamp = this.makeTimestampStrategy(BigInt(nanosLong.toString()));
        const timestampNode = DEFAULT_PROPERTY_TREE_NODE_FACTORY.makeProtoProperty(
          value.id,
          property.name,
          timestamp
        );
        timestampNodes.push(timestampNode);
      }
    }

    value.getAllChildren().forEach((property) => {
      this.apply(property);
    });

    return timestampNodes;
  }
}
