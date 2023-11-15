#include "mainwindow.h"
#include "ui_mainwindow.h"
#include "m3u8d.h"
#include <atomic>
#include <QFileDialog>
#include <QIntValidator>
#include <QMessageBox>
#include "curldialog.h"

MainWindow::MainWindow(QWidget *parent) :
    QMainWindow(parent),
    ui(new Ui::MainWindow),
    m_syncUi(parent)
{
    ui->setupUi(this);

    QIntValidator* vd = new QIntValidator(this);
    vd->setRange(0, 9999);
    ui->lineEdit_SkipTsCountFromHead->setValidator(vd);
    ui->lineEdit_SkipTsCountFromHead->setPlaceholderText("[0,9999]");
    ui->lineEdit_SaveDir->setPlaceholderText(QString::fromStdString(GetWd()));
    m_syncUi.AddRunFnOn_OtherThread([this](){
        while(!this->m_syncUi.Get_Done())
        {
            QThread::msleep(50);
            m_syncUi.AddRunFnOn_UiThread([this](){
                GetProgress_Resp resp = GetProgress();
                ui->progressBar->setValue(resp.Percent);
                ui->label_progressBar->setText(QString::fromStdString(resp.Title));
                ui->statusBar->showMessage(QString::fromStdString(resp.StatusBar), 5*1000);
            });
        }
    });
}

MainWindow::~MainWindow()
{
    CloseOldEnv();
    delete ui;
}

void MainWindow::on_pushButton_RunDownload_clicked()
{
    if (ui->lineEdit_M3u8Url->isEnabled()==false) {
        return;
    }
    ui->lineEdit_M3u8Url->setEnabled(false);
    ui->lineEdit_SaveDir->setEnabled(false);
    ui->pushButton_SaveDir->setEnabled(false);
    ui->lineEdit_FileName->setEnabled(false);
    ui->lineEdit_SkipTsCountFromHead->setEnabled(false);
    ui->pushButton_RunDownload->setEnabled(false);
    ui->checkBox_Insecure->setEnabled(false);
    ui->progressBar->setValue(0);
    ui->lineEdit_SetProxy->setEnabled(false);
    ui->pushButton_curlMode->setEnabled(false);
    ui->checkBox_SkipRemoveTs->setEnabled(false);
    ui->lineEdit_ThreadCount->setEnabled(false);
    ui->pushButton_StopDownload->setEnabled(true);

    RunDownload_Req req;
    req.M3u8Url = ui->lineEdit_M3u8Url->text().toStdString();
    req.Insecure = ui->checkBox_Insecure->isChecked();
    req.SaveDir = ui->lineEdit_SaveDir->text().toStdString();
    req.FileName = ui->lineEdit_FileName->text().toStdString();
    req.SkipTsCountFromHead = ui->lineEdit_SkipTsCountFromHead->text().toInt();
    req.SetProxy = ui->lineEdit_SetProxy->text().toStdString();
    req.HeaderMap = m_HeaderMap;
    req.SkipRemoveTs = ui->checkBox_SkipRemoveTs->isChecked();
    req.ThreadCount = ui->lineEdit_ThreadCount->text().toInt();

    m_syncUi.AddRunFnOn_OtherThread([req, this](){
        RunDownload_Resp resp = RunDownload(req);
        m_syncUi.AddRunFnOn_UiThread([req, this, resp](){
            ui->lineEdit_M3u8Url->setEnabled(true);
            ui->lineEdit_SaveDir->setEnabled(true);
            ui->pushButton_SaveDir->setEnabled(true);
            ui->lineEdit_FileName->setEnabled(true);
            ui->lineEdit_SkipTsCountFromHead->setEnabled(true);
            ui->pushButton_RunDownload->setEnabled(true);
            ui->checkBox_Insecure->setEnabled(true);
            ui->pushButton_RunDownload->setText("开始下载");
            ui->lineEdit_SetProxy->setEnabled(true);
            ui->pushButton_StopDownload->setEnabled(false);
            ui->pushButton_curlMode->setEnabled(true);
            ui->checkBox_SkipRemoveTs->setEnabled(true);
            ui->lineEdit_ThreadCount->setEnabled(true);
            if (resp.IsCancel) {
                return;
            }

            if (!resp.ErrMsg.empty()) {
                QMessageBox::warning(this, "下载错误", QString::fromStdString(resp.ErrMsg));
                return;
            }
            if (resp.IsSkipped) {
                Toast::Instance()->SetSuccess("已经下载过了: " + QString::fromStdString(resp.SaveFileTo));
                return;
            }
            Toast::Instance()->SetSuccess("下载成功, 保存路径" + QString::fromStdString(resp.SaveFileTo));
        });
    });
}

void MainWindow::on_pushButton_SaveDir_clicked()
{
    QString dir = QFileDialog::getExistingDirectory(this);
    ui->lineEdit_SaveDir->setText(dir);
}

void MainWindow::on_pushButton_StopDownload_clicked()
{
    CloseOldEnv();
}

void MainWindow::on_pushButton_curlMode_clicked()
{
    RunDownload_Req req;
    req.M3u8Url = ui->lineEdit_M3u8Url->text().toStdString();
    req.Insecure = ui->checkBox_Insecure->isChecked();
    req.HeaderMap = m_HeaderMap;
    CurlDialog dlg(this);
    dlg.SetText(QString::fromStdString(RunDownload_Req_ToCurlStr(req)));
    dlg.show();
    if (dlg.exec() != QDialog::Accepted) {
        return;
    }
    ParseCurl_Resp resp= dlg.Resp;
    ui->lineEdit_M3u8Url->setText(QString::fromStdString(resp.DownloadReq.M3u8Url));
    ui->checkBox_Insecure->setChecked(resp.DownloadReq.Insecure);
    this->m_HeaderMap = resp.DownloadReq.HeaderMap;
}

void MainWindow::on_lineEdit_M3u8Url_textChanged(const QString &arg1)
{
    if (ui->lineEdit_FileName->text().isEmpty()==false) {
        return;
    }
    QString fileName = QString::fromStdString(GetFileNameFromUrl(arg1.toStdString()));
    if (fileName.isEmpty()) {
        return;
    }
    ui->lineEdit_FileName->setPlaceholderText(fileName);
}
