export interface RedexAuthResponse {
  Data: {
    AccessToken: string;
    RefreshToken: string;
    ExpiresIn: string;
    TokenType: string;
    Scope: string;
  };
  Errors: null | Array<{
    Key: string;
    Message: string;
  }>;
  StatusCode: number;
  Message: string;
  Meta: null;
}

export interface RedexFileUplaodResponse {
  Errors: [];
  Meta: null;
  StatusCode: number;
  Data: {
    Id: string;
    ValidationCode: string;
  } | null;
  Message: string;
}
