namespace OpenDriverHub.Domain;

public enum UserRole
{
    Client = 0,
    Partner = 1,
    Admin = 2,
}

public enum ProductKind
{
    Physical = 0,
    Digital = 1,
    Voucher = 2,
}

public enum OrderStatus
{
    PendingPayment = 0,
    Paid = 1,
    Redeemed = 2,
    Cancelled = 3,
}

public enum PaymentStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Cancelled = 3,
    Refunded = 4,
}

public enum PaymentMethod
{
    Pix = 0,
    CreditCard = 1,
    DebitCard = 2,
}

public enum CategoryType
{
    Product = 0,
    Store = 1,
}

public enum LeadTemperature
{
    Frio = 0,
    Morno = 1,
    Quente = 2,
}
