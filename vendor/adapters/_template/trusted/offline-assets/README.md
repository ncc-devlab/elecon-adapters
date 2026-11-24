# SDK28 离线资产示例

`notice.list` 用模型的首字节在标签表中选择一条通知。模型和标签通过资产映射显式打包；入口只需使用逻辑路径。示例不访问网络。

从此目录运行下列命令。发布者首次签发时创建自己的 Ed25519 密钥，后续版本复用。

```sh
npm run scripts:sign -w tools -- sign --manifest manifest.json --source adapter.mjs \
  --entry dist/adapter.mjs --assets asset-map.json --key publisher.pem --out example.eleconpkg
```
