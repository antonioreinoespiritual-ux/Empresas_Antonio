-- AlterTable
ALTER TABLE "prices" ADD COLUMN     "enabledProviders" "PaymentProviderType"[] DEFAULT ARRAY[]::"PaymentProviderType"[];
