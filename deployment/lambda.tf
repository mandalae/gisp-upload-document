provider "aws" {
  region = "eu-west-1"
}

resource "aws_lambda_permission" "GPCovidResponse-uploadDocument" {
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.GPCovidResponse-uploadDocument.function_name}"
  principal     = "apigateway.amazonaws.com"
}

resource "aws_lambda_function" "GPCovidResponse-uploadDocument" {
  filename      = "../artifact/covid-backend.zip"
  function_name = "GPCovidResponse-uploadDocument"
  role          = "arn:aws:iam::368263227121:role/service-role/GPCovidResponse-Documents-role-k8gh1hnc"
  handler       = "index.handler"
  source_code_hash = "${filebase64sha256("../artifact/covid-backend.zip")}"
  runtime       = "nodejs12.x"

}
