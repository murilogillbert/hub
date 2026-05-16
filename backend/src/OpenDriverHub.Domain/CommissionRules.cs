namespace OpenDriverHub.Domain;

/// <summary>Regras puras de negócio (cashback e repasse ao parceiro).</summary>
public static class CommissionRules
{
    public static decimal CashbackFor(decimal price, decimal cashbackPercent)
        => Math.Round(price * cashbackPercent / 100m, 2);

    public static decimal PlatformFeeFor(decimal price, decimal feePercent)
        => Math.Round(price * feePercent / 100m, 2);

    /// <summary>Líquido do parceiro = pago − taxa da plataforma − cashback do cliente.</summary>
    public static decimal PartnerNet(decimal paidPrice, decimal platformFee, decimal cashback)
        => Math.Round(paidPrice - platformFee - cashback, 2);
}
