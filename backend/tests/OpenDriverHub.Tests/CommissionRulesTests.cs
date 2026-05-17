using OpenDriverHub.Domain;
using Xunit;

namespace OpenDriverHub.Tests;

public class CommissionRulesTests
{
    [Fact]
    public void CashbackFor_RoundsToCurrency()
    {
        var result = CommissionRules.CashbackFor(19.99m, 7.5m);

        Assert.Equal(1.50m, result);
    }

    [Fact]
    public void PartnerNet_SubtractsPlatformFeeAndCashback()
    {
        var platformFee = CommissionRules.PlatformFeeFor(100m, 12m);

        var result = CommissionRules.PartnerNet(100m, platformFee, 8m);

        Assert.Equal(80m, result);
    }
}
