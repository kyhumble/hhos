import { Global, Module } from '@nestjs/common';
import { PhotoEnvelopeCrypto } from './photo-envelope.crypto';

@Global()
@Module({
  providers: [PhotoEnvelopeCrypto],
  exports: [PhotoEnvelopeCrypto],
})
export class PhotoCryptoModule {}
