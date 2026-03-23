/** PLAN §6.6 — GraphQL documents */

export const FIND_INDEXES = /* GraphQL */ `
  query findIndexes($first: Int, $skip: Int, $orderBy: String, $orderDirection: String) {
    indexes(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection) {
      id
      address
      name
      symbol
      decimals
      totalSupply
      swapFee
      mintBurnFee
      holderCount
      assets {
        token {
          id
          address
          name
          symbol
          decimals
        }
        startWeight
        endWeight
        balance
      }
      liquidityPool {
        address
        reserve0
        reserve1
        fee
      }
    }
  }
`;

export const GET_INDEX = /* GraphQL */ `
  query getIndex($indexAddress: ID!) {
    index(id: $indexAddress) {
      id
      address
      name
      symbol
      decimals
      totalSupply
      swapFee
      mintBurnFee
      holderCount
      assets {
        token {
          id
          address
          name
          symbol
          decimals
        }
        startWeight
        endWeight
        balance
      }
      liquidityPool {
        address
        reserve0
        reserve1
        fee
      }
    }
  }
`;

export const FIND_USER_DATA = /* GraphQL */ `
  query findUserDataB($user: String!, $first: Int, $skip: Int) {
    userIndexBalances(
      where: { user: $user }
      first: $first
      skip: $skip
      orderBy: balance
      orderDirection: desc
    ) {
      index {
        id
        address
        name
        symbol
        decimals
        totalSupply
      }
      balance
    }
  }
`;
