export interface Customer {
  id: string;
  email: string;
  name: string | null;
  userId: string | null;
  createdAt: Date;
}
