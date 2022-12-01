/*
 * Copyright (C) 2022 The Android Open Source Project
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

export class MockStorage implements Storage {
  private store: { [key: string]: string } = {};

  [name: string]: any;
  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    throw new Error("Method not implemented.");
  }
  getItem(key: string): string | null {
    return this.store[key];
  }
  key(index: number): string | null {
    return Object.keys(this.store)[index];
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

}